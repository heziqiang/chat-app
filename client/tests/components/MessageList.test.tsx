import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MessageList from '../../src/components/MessageList';

const useAppMock = vi.fn();
const { useApolloClientMock, useQueryMock } = vi.hoisted(() => ({
  useApolloClientMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('../../src/context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../../src/socket', () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useApolloClient: useApolloClientMock,
    useQuery: useQueryMock,
  };
});

describe('MessageList', () => {
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
    });

    render(<MessageList />);

    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('renders message content from query data', () => {
    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useApolloClientMock.mockReturnValue({ cache: {} });
    useQueryMock.mockReturnValue({
      data: {
        messages: [
          {
            id: 'm1',
            content: 'Hello from Grace',
            createdAt: '2025-01-01T10:00:00.000Z',
            sender: {
              id: 'u2',
              username: 'grace',
              displayName: 'Grace Hopper',
              avatarUrl: 'https://example.com/grace.png',
            },
            replyTo: null,
          },
        ],
      },
      loading: false,
      error: null,
    });

    render(<MessageList />);

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Hello from Grace')).toBeInTheDocument();
  });
});
