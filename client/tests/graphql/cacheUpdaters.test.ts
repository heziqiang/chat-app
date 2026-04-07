import { InMemoryCache } from '@apollo/client';
import { describe, expect, it } from 'vitest';
import {
  MESSAGE_PAGE_SIZE,
  updateMessagesCache,
  updateChannelsCache,
} from '../../src/graphql/cacheUpdaters';
import { GET_CHANNELS, GET_MESSAGES } from '../../src/graphql/queries';

const message = {
  id: 'message-1',
  content: 'Hello from cache updater',
  createdAt: '2026-04-07T00:00:00.000Z',
  sender: {
    id: 'user-1',
    username: 'ada',
    displayName: 'Ada Lovelace',
    avatarUrl: 'https://example.com/ada.png',
  },
  mentions: [],
  replyTo: null,
};

describe('updateMessagesCache', () => {
  it('appends a new message when the channel query is already cached', () => {
    const cache = new InMemoryCache();
    const variables = { channelId: 'channel-1', limit: MESSAGE_PAGE_SIZE };

    cache.writeQuery({
      query: GET_MESSAGES,
      variables,
      data: {
        messages: [],
      },
    });

    updateMessagesCache(cache, 'channel-1', message);

    expect(cache.readQuery({ query: GET_MESSAGES, variables })).toEqual({
      messages: [message],
    });
  });

  it('preserves previously loaded history when appending a new message', () => {
    const cache = new InMemoryCache();
    const variables = { channelId: 'channel-1', limit: MESSAGE_PAGE_SIZE };
    const existingMessages = Array.from({ length: MESSAGE_PAGE_SIZE + 5 }, (_, index) => ({
      ...message,
      id: `message-${index + 1}`,
      content: `Message ${index + 1}`,
      createdAt: `2026-04-07T00:${String(index).padStart(2, '0')}:00.000Z`,
    }));

    cache.writeQuery({
      query: GET_MESSAGES,
      variables,
      data: {
        messages: existingMessages,
      },
    });

    updateMessagesCache(cache, 'channel-1', {
      ...message,
      id: 'message-new',
      content: 'Newest message',
    });

    expect(cache.readQuery({ query: GET_MESSAGES, variables })).toEqual({
      messages: [
        ...existingMessages,
        expect.objectContaining({
          id: 'message-new',
          content: 'Newest message',
        }),
      ],
    });
  });

  it('resets unread only when explicitly requested for the active channel', () => {
    const cache = new InMemoryCache();

    cache.writeQuery({
      query: GET_CHANNELS,
      data: {
        channels: [
          {
            id: 'channel-1',
            name: 'General',
            type: 'group',
            avatarUrl: '',
            members: [],
            lastMessage: null,
            unreadCount: 2,
          },
          {
            id: 'channel-2',
            name: 'DM',
            type: 'dm',
            avatarUrl: '',
            members: [],
            lastMessage: null,
            unreadCount: 1,
          },
        ],
      },
    });

    updateChannelsCache(cache, 'channel-1', message, {
      activeChannelId: 'channel-1',
    });
    updateChannelsCache(cache, 'channel-2', message, {
      activeChannelId: 'channel-1',
    });
    updateChannelsCache(cache, 'channel-1', message, {
      activeChannelId: 'channel-1',
      resetUnreadCount: false,
    });

    expect(cache.readQuery({ query: GET_CHANNELS })).toEqual({
      channels: [
        expect.objectContaining({
          id: 'channel-1',
          unreadCount: 1,
        }),
        expect.objectContaining({
          id: 'channel-2',
          unreadCount: 2,
        }),
      ],
    });
  });
});
