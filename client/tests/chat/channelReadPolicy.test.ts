import { describe, expect, it } from 'vitest';
import { shouldResetUnreadCountForIncomingMessage } from '../../src/chat/channelReadPolicy';

describe('shouldResetUnreadCountForIncomingMessage', () => {
  it('returns true only when the incoming message belongs to the active channel and latest message is visible', () => {
    expect(
      shouldResetUnreadCountForIncomingMessage('channel-1', {
        currentChannelId: 'channel-1',
        isLatestMessageVisible: true,
      }),
    ).toBe(true);

    expect(
      shouldResetUnreadCountForIncomingMessage('channel-1', {
        currentChannelId: 'channel-1',
        isLatestMessageVisible: false,
      }),
    ).toBe(false);

    expect(
      shouldResetUnreadCountForIncomingMessage('channel-2', {
        currentChannelId: 'channel-1',
        isLatestMessageVisible: true,
      }),
    ).toBe(false);
  });
});
