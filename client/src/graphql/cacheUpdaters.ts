import type { ApolloCache } from '@apollo/client';
import type { MessageData } from '../components/MessageItem';
import { GET_MESSAGES, GET_CHANNELS } from './queries';

interface MessageQueryData {
  messages: MessageData[];
}

interface ChannelListData {
  channels: Array<{
    id: string;
    name: string;
    type: 'group' | 'dm';
    avatarUrl: string;
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string;
    }>;
    lastMessage: {
      id: string;
      content: string;
      sender: { id: string; displayName: string };
      createdAt: string;
    } | null;
    unreadCount: number;
  }>;
}

export const MESSAGE_PAGE_SIZE = 30;

interface UpdateChannelsCacheOptions {
  activeChannelId?: string | null;
  resetUnreadCount?: boolean;
}

export function updateMessagesCache(
  cache: ApolloCache<unknown>,
  channelId: string,
  nextMessage: MessageData,
) {
  const variables = { channelId, limit: MESSAGE_PAGE_SIZE };
  const data = cache.readQuery<MessageQueryData>({
    query: GET_MESSAGES,
    variables,
  });
  if (!data) return;

  const existing = data.messages;
  if (existing.some((message) => message.id === nextMessage.id)) return;

  cache.writeQuery<MessageQueryData>({
    query: GET_MESSAGES,
    variables,
    data: {
      messages: [...existing, nextMessage].slice(-MESSAGE_PAGE_SIZE),
    },
  });
}

export function updateChannelsCache(
  cache: ApolloCache<unknown>,
  channelId: string,
  nextMessage: MessageData,
  options: UpdateChannelsCacheOptions = {},
) {
  cache.updateQuery<ChannelListData>({ query: GET_CHANNELS }, (data) => {
    if (!data) return data;

    return {
      channels: data.channels.map((channel) =>
        channel.id === channelId
          ? {
              ...channel,
              lastMessage: {
                id: nextMessage.id,
                content: nextMessage.content,
                createdAt: nextMessage.createdAt,
                sender: {
                  id: nextMessage.sender.id,
                  displayName: nextMessage.sender.displayName,
                },
              },
              unreadCount:
                options.resetUnreadCount || options.activeChannelId === channelId
                  ? 0
                  : channel.unreadCount + 1,
            }
          : channel,
      ),
    };
  });
}
