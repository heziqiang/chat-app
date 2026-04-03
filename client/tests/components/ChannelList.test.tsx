import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChannelList from '../../src/components/ChannelList';

const useAppMock = vi.fn();
const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('../../src/context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

describe('ChannelList', () => {
  it('shows current user channels and switches active channel on click', async () => {
    const setCurrentChannelId = vi.fn();
    const user = userEvent.setup();

    useAppMock.mockReturnValue({
      currentUser: {
        id: 'u1',
        displayName: 'Ada Lovelace',
        avatarUrl: 'https://example.com/ada.png',
      },
      setCurrentUser: vi.fn(),
      currentChannelId: null,
      setCurrentChannelId,
    });

    useQueryMock.mockReturnValue({
      data: {
        channels: [
          {
            id: 'group-1',
            name: 'Engineering',
            type: 'group',
            avatarUrl: 'https://example.com/group.png',
            members: [
              { id: 'u1', displayName: 'Ada Lovelace', avatarUrl: 'https://example.com/ada.png' },
              { id: 'u2', displayName: 'Grace Hopper', avatarUrl: 'https://example.com/grace.png' },
            ],
            lastMessage: null,
            unreadCount: 2,
          },
          {
            id: 'dm-1',
            name: '',
            type: 'dm',
            avatarUrl: '',
            members: [
              { id: 'u1', displayName: 'Ada Lovelace', avatarUrl: 'https://example.com/ada.png' },
              { id: 'u3', displayName: 'Linus Torvalds', avatarUrl: 'https://example.com/linus.png' },
            ],
            lastMessage: null,
            unreadCount: 0,
          },
          {
            id: 'hidden-1',
            name: 'Hidden',
            type: 'group',
            avatarUrl: '',
            members: [
              { id: 'u9', displayName: 'Other User', avatarUrl: 'https://example.com/other.png' },
            ],
            lastMessage: null,
            unreadCount: 0,
          },
        ],
      },
      loading: false,
      error: null,
    });

    render(<ChannelList />);

    expect(screen.getByRole('button', { name: /engineering/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /linus torvalds/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hidden/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /engineering/i }));

    expect(setCurrentChannelId).toHaveBeenCalledWith('group-1');
  });
});
