import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MessageComposer from '../../src/components/MessageComposer';

const useAppMock = vi.fn();
const { useMutationMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
}));

vi.mock('../../src/context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useMutation: useMutationMock,
  };
});

describe('MessageComposer', () => {
  it('sends trimmed content on Enter', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue({ data: { sendMessage: { id: 'm1' } } });

    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useMutationMock.mockImplementation((_, options) => [
      async (payload: unknown) => {
        const result = await mutate(payload);
        options?.onCompleted?.();
        return result;
      },
      { loading: false, error: null },
    ]);

    render(<MessageComposer />);

    const input = screen.getByPlaceholderText('Type a message...');
    expect(input).toHaveAttribute('rows', '2');
    await user.type(input, '  Hello team  ');
    await user.keyboard('{Enter}');

    expect(mutate).toHaveBeenCalledWith({
      variables: {
        input: {
          channelId: 'channel-1',
          content: 'Hello team',
        },
      },
    });
    expect(input).toHaveValue('');
  });

  it('does not send whitespace-only content', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();

    useAppMock.mockReturnValue({
      currentChannelId: 'channel-1',
      currentUser: { id: 'u1' },
    });
    useMutationMock.mockReturnValue([mutate, { loading: false, error: null }]);

    render(<MessageComposer />);

    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, '   ');
    await user.keyboard('{Enter}');

    expect(mutate).not.toHaveBeenCalled();
  });
});
