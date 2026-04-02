const typeDefs = `#graphql
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
    type: String!
    avatarUrl: String
    members: [User!]!
    lastMessage: Message
    unreadCount: Int!
  }

  type Message {
    id: ID!
    channel: Channel!
    sender: User!
    content: String!
    replyTo: Message
    mentions: [User!]!
    createdAt: String!
  }

  type Query {
    channels: [Channel!]!
    messages(channelId: ID!, limit: Int = 30, before: ID): [Message!]!
    users(search: String): [User!]!
  }

  type Mutation {
    sendMessage(input: SendMessageInput!): Message!
    markAsRead(channelId: ID!, messageId: ID!): Boolean!
  }

  input SendMessageInput {
    channelId: ID!
    content: String!
    replyTo: ID
    mentions: [ID!]
  }
`;

export default typeDefs;
