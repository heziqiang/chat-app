import type { ApolloCache } from '@apollo/client';
import type { MessageData } from '../chat/types';
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
      messages: [...existing, nextMessage],
    },
  });
}

export function resetChannelUnreadCount(
  cache: ApolloCache<unknown>,
  channelId: string,
) {
  cache.updateQuery<ChannelListData>({ query: GET_CHANNELS }, (data) => {
    if (!data) return data;
    const channel = data.channels.find((c) => c.id === channelId);
    if (!channel || channel.unreadCount === 0) return data;

    return {
      channels: data.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: 0 } : c,
      ),
    };
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

    const shouldResetUnread =
      options.resetUnreadCount ?? options.activeChannelId === channelId;

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
              unreadCount: shouldResetUnread ? 0 : channel.unreadCount + 1,
            }
          : channel,
      ),
    };
  });
}
