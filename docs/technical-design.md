# Gradual Chat — 技术设计文档

## 1. 项目概述

参照 Gradual 社区平台的 Chat 交互设计，从零实现一个独立的频道消息系统，支持消息收发与实时同步。

**技术栈**：React.js (TypeScript) / Node.js (TypeScript) / MongoDB / GraphQL / Socket.io

**用户身份**：这里不做认证/登录流程，直接前端组件选择用户，`userId` 存 sessionStorage（浏览器 Tab 隔离），请求带 `x-user-id` header，Socket.io 连接走 `auth` 参数。开两个 tab 选不同用户即可验证实时同步。

## 2. UI 结构

设计稿 [Figma](https://www.figma.com/design/CBKcxWGEJGFe05ZsbgZZ2z/Full-Stack-Developer-Assignment?node-id=0-394)。

经典左右分栏：左侧频道列表（名称、头像、最后消息预览、未读 badge），右侧消息区 + 底部输入框。

消息布局上需要注意的点：
- 自己的消息右对齐、teal 背景；他人消息左对齐、深色背景，带头像和昵称
- Hover 时露出操作按钮（引用、删除）
- 群聊右上角展示人数，点击查看群成员列表

## 3. 数据模型

Mongoose `timestamps: true`，以下只列业务字段：

```
User {
  username:     string        // 唯一标识
  displayName:  string
  avatarUrl:    string
  title:        string        // 职位，如 "CTO"
}

Channel {
  name:         string        // 群聊名称，DM 为空
  type:         'group'|'dm'  // 群聊 / 单聊
  avatarUrl:    string
  memberUserIds: ObjectId[]   // 成员列表，DM 固定 2 人
}

Message {
  channelId:    ObjectId
  senderId:     ObjectId
  content:      string
  replyToId:    ObjectId?     // P1: 引用回复
  mentionUserIds: ObjectId[]  // P1: @提及
}

ReadStatus {                  // P1: 未读计数
  userId:       ObjectId
  channelId:    ObjectId
  lastReadMessageId: ObjectId
}
```

**索引**：
- `Message`: `{ channelId: 1, _id: 1 }` — ObjectId 天然单调递增，兼做时间排序和分页 cursor
- `ReadStatus`: `{ userId: 1, channelId: 1 }` unique — 快速定位用户的已读状态

## 4. GraphQL API

### Schema

```graphql
type User {
  id: ID!
  username: String!
  displayName: String!
  avatarUrl: String
  title: String
}

type Channel {
  id: ID!
  name: String!
  type: String!                   # "group" | "dm"
  avatarUrl: String
  members: [User!]!               # DM 时取对方信息
  lastMessage: Message            # 频道列表展示用
  unreadCount: Int                # P1
}

type Message {
  id: ID!
  channel: Channel!
  sender: User!
  content: String!
  replyTo: Message              # P1
  mentions: [User!]!            # P1
  createdAt: String!
}

type Query {
  channels: [Channel!]!
  messages(channelId: ID!, limit: Int = 30, before: ID): [Message!]!
  users(search: String): [User!]!    # P1: mention 用户搜索
}

type Mutation {
  sendMessage(input: SendMessageInput!): Message!
  markAsRead(channelId: ID!, messageId: ID!): Boolean!   # P1
}

input SendMessageInput {
  channelId: ID!
  content: String!
  replyTo: ID                   # P1
  mentions: [ID!]               # P1
}
```

### 分页

`limit + before`，`before` 为 `_id`：

```
messages(channelId: "xxx", limit: 30, before: "6651a...")
→ Message.find({ channelId, _id: { $lt: beforeId } }).sort({ _id: -1 }).limit(30)
```

查询和排序都走 `_id`，不需要额外的 `createdAt` 排序字段。

## 5. 实时通信

消息写入走 GraphQL mutation，实时通知走 Socket.io broadcast。核心流程：

```
发送者 → GraphQL mutation → Server 写 DB → Socket.io broadcast → 其他客户端收到
```

发送者用 mutation response 更新自己的 UI；`socket.broadcast.to(room)` 只推给其他人，避免重复。

### Socket.io 事件

| 事件 | 方向 | 负载 | 说明 |
|------|------|------|------|
| `join_channel` | C→S | `{ channelId }` | 进入房间 |
| `leave_channel` | C→S | `{ channelId }` | 离开房间 |
| `new_message` | S→C | `Message` 对象 | 新消息广播 |
| `channel_updated` | S→C | `{ channelId, lastMessage }` | 频道列表刷新 |

连接策略：客户端启动时连接并加入所有频道 room，切换频道不需要重连。断线自动重连后拉一次最新消息做对齐。

## 6. 架构要点

**前端状态管理**：Apollo Client 管 GraphQL 缓存，React Context 管少量客户端状态（当前频道、当前用户）。Socket.io 收到新消息直接写 Apollo Cache，UI 自动响应。

**后端组装**：Apollo Server + Express，Socket.io 实例挂到 GraphQL context 里，resolver 写完 DB 后直接通过 `context.io` 广播。

**Seed Data**：3 个群聊频道 + 2 个单聊会话、4 个用户，每个频道 3-6 条消息。保证启动即有内容可看。包含 2 条引用回复消息。

**测试**：前端使用 `Vitest + React Testing Library`，后端使用 `Vitest + Supertest`，只覆盖关键链路：`messages`、`sendMessage`、`markAsRead`，以及前端的用户选择、频道切换、消息渲染、发送输入。选择 `Vitest` 主要因为它和 `Vite` 结合更自然、配置更简便；暂时不做 `Playwright/Cypress` E2E。

**本地开发**：日常开发直接跑 `server` 和 `client` 的 dev server，不依赖 Docker。数据库通过 `MONGODB_URI` 连接，本地 MongoDB 或云端 MongoDB 都可以。

**数据库**：数据库独立于应用部署，使用外部 MongoDB 实例；应用只保存连接串，不在容器内自带数据库。

**部署**：部署目标是单台 VPS。代码推到仓库后，在 VPS 上拉代码、配置 `server/.env`，再执行 `docker compose up -d --build`。Docker Compose 只编排一个 App 容器。
前端静态资源，这里为了简化 直接由 node `express.static` 托管。 生产环境会使用 CDN + S3。


## 7. 功能清单与优先级

### P0

| # | 功能 | 说明 |
|---|------|---------|
| 1 | 频道列表 | 展示所有频道，含名称、头像、最后消息预览 |
| 2 | 频道切换 | 点击加载对应消息，当前频道高亮 |
| 3 | 消息列表 | 时间正序，区分自己/他人的布局，上滑加载更多历史消息 |
| 4 | 发送消息 | 写入 DB 并出现在列表 |
| 5 | 实时同步 | A 发消息，B 实时看到 |
| 6 | 刷新保持 | 数据从 DB 读，不丢 |
| 7 | Loading / Empty / Error | 三状态齐全 |
| 8 | Seed Data / Demo 说明 | Seed Data 完整；README 清楚描述本地开发和 Docker 部署方式 |

### P1（按优先级排列）

| # | 功能 | 说明 |
|---|------|------|
| 1 | Quote Reply | 点引用 → 输入框出现预览 → 发送附带引用块；数据层 `replyTo`。 |
| 2 | 单元测试 | 前端：Vitest + RTL；后端：Vitest + Supertest。优先覆盖 `sendMessage`、`messages`、`markAsRead` 等关键主链路。 |
| 3 | Unread Count | 频道列表 badge，ReadStatus 模型，进频道标已读。 |
| 4 | Mention | `@` 弹搜索 → 选人 → 消息高亮；通知提醒。 |

其中 Mention 分可以分两档实现:
1. 基础实现：输入框支持 `@` 搜索和选人，发送消息时结构化记录 `mentions`，消息列表按 mention 数据做高亮。只解决“可提及、可识别、可展示”，不做独立通知。
2. 完整实现：在基础档之上，把 mention 作为高优先级消息事件处理，补充 mention unread、badge、站内提醒或 push 等能力。会进入整个消息数据流、未读体系和通知体系。

## 8. 未来拓展与优化
由于时间原因，本次只聚焦核心的功能。
对于聊天场景，还有很多可以继续优化的部分。

| 暂未实现功能 | 可选的方案 |
|--------|-----------|
| 用户认证 | JWT + middleware |
| 富文本 | Slate / TipTap |
| 乐观更新 | Optimistic UI + rollback |
| 分布式 Socket.io | `@socket.io/redis-adapter` |
| 消息删除 | soft delete |
| Mention 通知体系 | mention unread / badge / inbox / push |
| Typing indicator | Socket.io + debounce |
