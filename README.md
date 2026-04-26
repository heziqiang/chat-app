# Realtime Chat App

A real-time channel messaging app built as a full-stack demo. Supports group channels, direct messages, quote replies, unread tracking, and live message sync.

**Tech stack**: React + TypeScript / Node.js + Apollo Server 5 + Express / MongoDB / Socket.io / GraphQL

## Quick Start (Docker)

```bash
# 1. Configure database connection
cp server/.env.example server/.env
# Edit server/.env

# 2. Start the app
docker compose up -d --build

# 3. Seed sample data
docker compose exec app node dist/seed/index.js

# 4. Open the app
open http://localhost
```

To stop:

```bash
docker compose down
```

## Deployment

Deploy on a single VPS. The normal flow is: push code, SSH into the VPS, pull the latest code, configure `server/.env`, then run `docker compose up -d --build`. The app runs as one Node.js container and connects to external MongoDB.

## Local Development

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure database connection
cp server/.env.example server/.env
# Edit server/.env

# 3. Seed the database
npm run seed

# 4. Start server (port 4000) and client (port 5173)
npm run dev
```

Then open http://localhost:5173. The Vite dev server proxies `/graphql` and `/socket.io` to the backend automatically.

## Testing

```bash
cd server && npm test    # Backend: Vitest + Supertest
cd client && npm test    # Frontend: Vitest + React Testing Library
```

## Features

- **Channel list** — group & DM channels with last-message preview and unread badge
- **Message feed** — chronological display, own messages right-aligned (teal), others left-aligned (dark)
- **Send messages** — Enter to send, Shift+Enter for newline
- **Real-time sync** — Socket.io broadcast; open two tabs with different users to verify
- **Quote reply** — click reply on a message, quoted block appears in the new message
- **Unread count** — badge on channel list, resets when you enter the channel
- **User switching** — pick a user on launch, switch anytime from the sidebar header
- **Group member list** — click the members icon in group channel header

## User Identity

No authentication — select a user from the picker on launch. Each browser tab maintains its own session via `sessionStorage`. Open two tabs, pick different users, and chat between them.

## Project Structure

```
server/          Node.js + Apollo Server + Socket.io
  src/
    graphql/     Schema, resolvers
    models/      Mongoose models (User, Channel, Message, ReadStatus)
    seed/        Database seeding script
    socket.ts    Socket.io event handlers
    index.ts     Server entry point

client/          React + Vite + Apollo Client
  src/
    components/  UI components
    context/     React context (current user, channel)
    graphql/     Queries, mutations, cache updaters
    socket.ts    Socket.io client singleton
```

## Architecture

- **Writes**: GraphQL mutations (sendMessage, markAsRead)
- **Reads**: GraphQL queries with Apollo Client cache
- **Real-time**: Socket.io broadcasts new messages to other users in the channel (sender excluded to avoid duplicates)
- **Pagination**: Cursor-based using MongoDB `_id` (`limit` + `before` params)
- **Database**: MongoDB, local or cloud (Atlas)
- **Static files**: Express serves the client build output via `express.static` for demo simplicity; production would use CDN + S3

## Docs

- [Technical Design](./docs/technical-design.md)
