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

  it('keeps current channel unread count at 0 and increments background channels', () => {
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

    expect(cache.readQuery({ query: GET_CHANNELS })).toEqual({
      channels: [
        expect.objectContaining({
          id: 'channel-1',
          unreadCount: 0,
        }),
        expect.objectContaining({
          id: 'channel-2',
          unreadCount: 2,
        }),
      ],
    });
  });
});
