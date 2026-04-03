import { afterEach, describe, expect, it, vi } from 'vitest';
import { Channel } from '../src/models';
import { joinAuthorizedChannel } from '../src/socket';

describe('joinAuthorizedChannel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('joins the room when the socket user belongs to the channel', async () => {
    const join = vi.fn();
    vi.spyOn(Channel, 'exists').mockResolvedValue({ _id: 'room-1' } as never);

    const joined = await joinAuthorizedChannel(
      {
        handshake: {
          auth: { userId: '507f1f77bcf86cd799439011' },
        },
        join,
      } as never,
      '507f1f77bcf86cd799439012',
    );

    expect(joined).toBe(true);
    expect(join).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
  });

  it('refuses to join when the socket user is not a channel member', async () => {
    const join = vi.fn();
    vi.spyOn(Channel, 'exists').mockResolvedValue(null);

    const joined = await joinAuthorizedChannel(
      {
        handshake: {
          auth: { userId: '507f1f77bcf86cd799439011' },
        },
        join,
      } as never,
      '507f1f77bcf86cd799439012',
    );

    expect(joined).toBe(false);
    expect(join).not.toHaveBeenCalled();
  });
});
