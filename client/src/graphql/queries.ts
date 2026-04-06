import { gql } from '@apollo/client';

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      username
      displayName
      avatarUrl
      title
    }
  }
`;

export const GET_CHANNELS = gql`
  query GetChannels {
    channels {
      id
      name
      type
      avatarUrl
      members {
        id
        displayName
        avatarUrl
      }
      lastMessage {
        id
        content
        sender {
          id
          displayName
        }
        createdAt
      }
      unreadCount
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($channelId: ID!, $limit: Int, $before: ID) {
    messages(channelId: $channelId, limit: $limit, before: $before) {
      id
      content
      createdAt
      sender {
        id
        username
        displayName
        avatarUrl
      }
      replyTo {
        id
        content
        sender {
          id
          displayName
        }
      }
    }
  }
`;

export const MARK_AS_READ = gql`
  mutation MarkAsRead($channelId: ID!, $messageId: ID!) {
    markAsRead(channelId: $channelId, messageId: $messageId)
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      createdAt
      sender {
        id
        username
        displayName
        avatarUrl
      }
      replyTo {
        id
        content
        sender {
          id
          displayName
        }
      }
    }
  }
`;
