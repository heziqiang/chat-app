import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import UserPicker from '../../src/components/UserPicker';

const useAppMock = vi.fn();

vi.mock('../../src/context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

describe('UserPicker', () => {
  it('renders users and selects one on click', async () => {
    const setCurrentUser = vi.fn();
    const user = userEvent.setup();

    useAppMock.mockReturnValue({
      users: [
        {
          id: 'u1',
          username: 'ada',
          displayName: 'Ada Lovelace',
          avatarUrl: 'https://example.com/ada.png',
          title: 'Engineer',
        },
      ],
      usersLoading: false,
      usersError: null,
      setCurrentUser,
    });

    render(<UserPicker />);

    await user.click(screen.getByRole('button', { name: /ada lovelace/i }));

    expect(screen.getByText('Who are you?')).toBeInTheDocument();
    expect(setCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', displayName: 'Ada Lovelace' }),
    );
  });
});
