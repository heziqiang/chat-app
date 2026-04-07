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

  it('sends with replyTo when replyingTo is set', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue({ data: { sendMessage: { id: 'm2' } } });
    const onClearReply = vi.fn();

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

    const replyingTo = {
      id: 'msg-99',
      content: 'Original message',
      createdAt: '2024-01-01T00:00:00Z',
      sender: { id: 'u2', username: 'alice', displayName: 'Alice', avatarUrl: '' },
      replyTo: null,
    };

    render(
      <MessageComposer replyingTo={replyingTo} onClearReply={onClearReply} />,
    );

    expect(screen.getByText('Alice:')).toBeInTheDocument();
    expect(screen.getByText('Original message')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, 'Reply text');
    await user.keyboard('{Enter}');

    expect(mutate).toHaveBeenCalledWith({
      variables: {
        input: {
          channelId: 'channel-1',
          content: 'Reply text',
          replyTo: 'msg-99',
        },
      },
    });
    expect(onClearReply).toHaveBeenCalled();
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
