import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MESSAGE_PAGE_SIZE } from '../../src/graphql/cacheUpdaters';
import MessageList from '../../src/components/MessageList';

const useAppMock = vi.fn();
const {
  useApolloClientMock,
  useQueryMock,
  socketOnMock,
  socketOffMock,
  updateMessagesCacheMock,
  updateChannelsCacheMock,
  resetChannelUnreadCountMock,
} = vi.hoisted(() => ({
  useApolloClientMock: vi.fn(),
  useQueryMock: vi.fn(),
  socketOnMock: vi.fn(),
  socketOffMock: vi.fn(),
  updateMessagesCacheMock: vi.fn(),
  updateChannelsCacheMock: vi.fn(),
  resetChannelUnreadCountMock: vi.fn(),
}));

vi.mock('../../src/context/AppContext', () => ({
  useApp: () => useAppMock(),
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
    updateMessagesCache: updateMessagesCacheMock,
    updateChannelsCache: updateChannelsCacheMock,
    resetChannelUnreadCount: resetChannelUnreadCountMock,
  };
});

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useApolloClient: useApolloClientMock,
    useQuery: useQueryMock,
    useMutation: () => [vi.fn().mockResolvedValue({ data: { markAsRead: true } })],
  };
  });

  describe('MessageList', () => {
  it('does not reset unread count for socket messages from background channels', () => {
    const cache = {};
    const message = {
      id: 'm2',
      content: 'Background update',
      createdAt: '2025-01-01T10:05:00.000Z',
      sender: {
        id: 'u2',
        username: 'grace',
        displayName: 'Grace Hopper',
        avatarUrl: 'https://example.com/grace.png',
      },
      mentions: [],
      replyTo: null,
    };

    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useApolloClientMock.mockReturnValue({ cache });
    useQueryMock.mockReturnValue({
      data: {
        messages: [
          {
            id: 'm1',
            content: 'Current channel message',
            createdAt: '2025-01-01T10:00:00.000Z',
            sender: {
              id: 'u2',
              username: 'grace',
              displayName: 'Grace Hopper',
              avatarUrl: 'https://example.com/grace.png',
            },
            mentions: [],
            replyTo: null,
          },
        ],
      },
      loading: false,
      error: null,
      fetchMore: vi.fn(),
    });

    render(<MessageList />);

    const handleNewMessage = socketOnMock.mock.calls.find(
      ([eventName]: [string]) => eventName === 'new_message',
    )?.[1] as ((payload: { channelId: string; message: typeof message }) => void) | undefined;

    expect(handleNewMessage).toBeDefined();

    handleNewMessage?.({
      channelId: 'channel-2',
      message,
    });

    expect(updateMessagesCacheMock).toHaveBeenCalledWith(cache, 'channel-2', message);
    expect(updateChannelsCacheMock).toHaveBeenCalledWith(cache, 'channel-2', message, {
      activeChannelId: 'channel-1',
      resetUnreadCount: false,
    });
  });

  it('shows empty state when there are no messages', () => {
    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useApolloClientMock.mockReturnValue({ cache: {} });
    useQueryMock.mockReturnValue({
      data: { messages: [] },
      loading: false,
      error: null,
      fetchMore: vi.fn(),
    });

    render(<MessageList />);

    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('renders message content from query data', () => {
    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useApolloClientMock.mockReturnValue({ cache: { updateQuery: vi.fn() } });
    useQueryMock.mockReturnValue({
      data: {
        messages: [
          {
            id: 'm1',
            content: 'Hello @Grace Hopper',
            createdAt: '2025-01-01T10:00:00.000Z',
            sender: {
              id: 'u2',
              username: 'grace',
              displayName: 'Grace Hopper',
              avatarUrl: 'https://example.com/grace.png',
            },
            mentions: [
              {
                id: 'u2',
                username: 'grace',
                displayName: 'Grace Hopper',
              },
            ],
            replyTo: null,
          },
        ],
      },
      loading: false,
      error: null,
      fetchMore: vi.fn(),
    });

    render(<MessageList />);

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    const mention = screen.getByText('@Grace Hopper');
    expect(mention).toBeInTheDocument();
    expect(mention).toHaveClass('message-mention');
  });

  it('loads older messages when scrolled to the top', async () => {
    const fetchMoreMock = vi.fn().mockResolvedValue({
      data: {
        messages: [
          {
            id: 'older-message',
            content: 'Older message',
            createdAt: '2025-01-01T09:00:00.000Z',
            sender: {
              id: 'u2',
              username: 'grace',
              displayName: 'Grace Hopper',
              avatarUrl: 'https://example.com/grace.png',
            },
            mentions: [],
            replyTo: null,
          },
        ],
      },
    });

    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useApolloClientMock.mockReturnValue({ cache: { updateQuery: vi.fn() } });
    useQueryMock.mockReturnValue({
      data: {
        messages: Array.from({ length: MESSAGE_PAGE_SIZE }, (_, index) => ({
          id: `message-${index + 1}`,
          content: `Message ${index + 1}`,
          createdAt: `2025-01-01T10:${String(index).padStart(2, '0')}:00.000Z`,
          sender: {
            id: 'u2',
            username: 'grace',
            displayName: 'Grace Hopper',
            avatarUrl: 'https://example.com/grace.png',
          },
          mentions: [],
          replyTo: null,
        })),
      },
      loading: false,
      error: null,
      fetchMore: fetchMoreMock,
    });

    const { container } = render(<MessageList />);
    const list = container.querySelector('.message-list') as HTMLDivElement | null;

    expect(list).not.toBeNull();

    Object.defineProperty(list!, 'scrollHeight', {
      configurable: true,
      value: 1200,
      writable: true,
    });
    Object.defineProperty(list!, 'clientHeight', {
      configurable: true,
      value: 600,
      writable: true,
    });
    Object.defineProperty(list!, 'scrollTop', {
      configurable: true,
      value: 0,
      writable: true,
    });

    fireEvent.scroll(list!);

    await waitFor(() => {
      expect(fetchMoreMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            channelId: 'channel-1',
            limit: MESSAGE_PAGE_SIZE,
            before: 'message-1',
          },
          updateQuery: expect.any(Function),
        }),
      );
    });
  });
});
