import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RealtimeChannelSync from '../../src/chat/RealtimeChannelSync';

const {
  useApolloClientMock,
  socketOnMock,
  socketOffMock,
  updateChannelsCacheMock,
} = vi.hoisted(() => ({
  useApolloClientMock: vi.fn(),
  socketOnMock: vi.fn(),
  socketOffMock: vi.fn(),
  updateChannelsCacheMock: vi.fn(),
}));

vi.mock('../../src/socket', () => ({
  getSocket: () => ({
    on: socketOnMock,
    off: socketOffMock,
  }),
}));

vi.mock('../../src/graphql/cacheUpdaters', async () => {
  const actual = await vi.importActual<typeof import('../../src/graphql/cacheUpdaters')>(
    '../../src/graphql/cacheUpdaters',
  );
  return {
    ...actual,
    updateChannelsCache: updateChannelsCacheMock,
  };
});

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useApolloClient: useApolloClientMock,
  };
});

describe('RealtimeChannelSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets unread when the active channel latest message is visible', () => {
    const cache = {};
    const message = {
      id: 'm1',
      content: 'New realtime message',
      createdAt: '2026-04-09T10:00:00.000Z',
      sender: {
        id: 'u2',
        username: 'grace',
        displayName: 'Grace Hopper',
        avatarUrl: 'https://example.com/grace.png',
      },
      mentions: [],
      replyTo: null,
    };

    useApolloClientMock.mockReturnValue({ cache });

    render(
      <RealtimeChannelSync
        currentChannelId="channel-2"
        isLatestMessageVisible
      />,
    );

    const handleNewMessage = socketOnMock.mock.calls.find(
      ([eventName]: [string]) => eventName === 'new_message',
    )?.[1] as ((payload: { channelId: string; message: typeof message }) => void) | undefined;

    expect(handleNewMessage).toBeDefined();

    handleNewMessage?.({
      channelId: 'channel-2',
      message,
    });

    expect(updateChannelsCacheMock).toHaveBeenCalledWith(cache, 'channel-2', message, {
      resetUnreadCount: true,
    });
  });

  it('keeps unread when the active channel latest message is not visible', () => {
    const cache = {};
    const message = {
      id: 'm2',
      content: 'Background while reading history',
      createdAt: '2026-04-09T10:05:00.000Z',
      sender: {
        id: 'u2',
        username: 'grace',
        displayName: 'Grace Hopper',
        avatarUrl: 'https://example.com/grace.png',
      },
      mentions: [],
      replyTo: null,
    };

    useApolloClientMock.mockReturnValue({ cache });

    render(
      <RealtimeChannelSync
        currentChannelId="channel-2"
        isLatestMessageVisible={false}
      />,
    );

    const handleNewMessage = socketOnMock.mock.calls.find(
      ([eventName]: [string]) => eventName === 'new_message',
    )?.[1] as ((payload: { channelId: string; message: typeof message }) => void) | undefined;

    expect(handleNewMessage).toBeDefined();

    handleNewMessage?.({
      channelId: 'channel-2',
      message,
    });

    expect(updateChannelsCacheMock).toHaveBeenCalledWith(cache, 'channel-2', message, {
      resetUnreadCount: false,
    });
  });

  it('keeps unread for background channel messages', () => {
    const cache = {};
    const message = {
      id: 'm3',
      content: 'Other channel update',
      createdAt: '2026-04-09T10:10:00.000Z',
      sender: {
        id: 'u3',
        username: 'linus',
        displayName: 'Linus Torvalds',
        avatarUrl: 'https://example.com/linus.png',
      },
      mentions: [],
      replyTo: null,
    };

    useApolloClientMock.mockReturnValue({ cache });

    render(
      <RealtimeChannelSync
        currentChannelId="channel-1"
        isLatestMessageVisible
      />,
    );

    const handleNewMessage = socketOnMock.mock.calls.find(
      ([eventName]: [string]) => eventName === 'new_message',
    )?.[1] as ((payload: { channelId: string; message: typeof message }) => void) | undefined;

    expect(handleNewMessage).toBeDefined();

    handleNewMessage?.({
      channelId: 'channel-2',
      message,
    });

    expect(updateChannelsCacheMock).toHaveBeenCalledWith(cache, 'channel-2', message, {
      resetUnreadCount: false,
    });
  });

  it('removes the socket listener on unmount', () => {
    useApolloClientMock.mockReturnValue({ cache: {} });

    const { unmount } = render(
      <RealtimeChannelSync
        currentChannelId="channel-1"
        isLatestMessageVisible
      />,
    );
    const handleNewMessage = socketOnMock.mock.calls.find(
      ([eventName]: [string]) => eventName === 'new_message',
    )?.[1];

    unmount();

    expect(socketOffMock).toHaveBeenCalledWith('new_message', handleNewMessage);
  });
});
