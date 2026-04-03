import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../src/context/AppContext';

const { socketMock, useQueryMock } = vi.hoisted(() => ({
  socketMock: {
    auth: {},
    connect: vi.fn(),
    connected: true,
    disconnect: vi.fn(),
    emit: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
  },
  useQueryMock: vi.fn(),
}));

vi.mock('../../src/socket', () => ({
  getSocket: () => socketMock,
}));

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

describe('AppProvider socket lifecycle', () => {
  it('keeps the existing socket connection when channel data updates', async () => {
    sessionStorage.setItem('gradual-chat-userId', 'user-1');

    let channelsData = {
      channels: [{ id: 'channel-1' }],
    };

    useQueryMock.mockImplementation((_query, options?: { skip?: boolean }) => {
      if (options) {
        return {
          data: channelsData,
          loading: false,
          error: null,
        };
      }

      return {
        data: {
          users: [
            {
              id: 'user-1',
              username: 'ada',
              displayName: 'Ada Lovelace',
              avatarUrl: 'https://example.com/ada.png',
              title: 'Engineer',
            },
          ],
        },
        loading: false,
        error: null,
      };
    });

    const view = render(
      <AppProvider>
        <div>child</div>
      </AppProvider>,
    );

    await waitFor(() => {
      expect(socketMock.connect).toHaveBeenCalledTimes(1);
    });
    expect(socketMock.emit).toHaveBeenCalledTimes(1);
    expect(socketMock.emit).toHaveBeenCalledWith('join_channel', {
      channelId: 'channel-1',
    });
    socketMock.connect.mockClear();
    socketMock.disconnect.mockClear();
    socketMock.emit.mockClear();

    channelsData = {
      channels: [{ id: 'channel-1' }],
    };
    view.rerender(
      <AppProvider>
        <div>child</div>
      </AppProvider>,
    );

    await waitFor(() => {
      expect(useQueryMock).toHaveBeenCalled();
    });
    expect(socketMock.connect).not.toHaveBeenCalled();
    expect(socketMock.disconnect).not.toHaveBeenCalled();
    expect(socketMock.emit).not.toHaveBeenCalled();
  });
});
