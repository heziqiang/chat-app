import mongoose from 'mongoose';
import request, { type SuperTest, type Test } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, connectToDatabase, syncModelIndexes } from '../src/index';
import { clearDatabase, seedDatabase } from '../src/seed';

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/gradual-chat-test';

describe('GraphQL API', () => {
  let api: SuperTest<Test>;
  let fixtures: Awaited<ReturnType<typeof seedDatabase>>;
  let stopApollo: (() => Promise<void>) | null = null;
  let ioRef: Awaited<ReturnType<typeof createApp>>['ioRef'];

  beforeAll(async () => {
    await connectToDatabase(TEST_MONGODB_URI);
    await syncModelIndexes();

    const createdApp = await createApp();
    const { app, apollo } = createdApp;
    api = request(app);
    stopApollo = () => apollo.stop();
    ioRef = createdApp.ioRef;
  });

  beforeEach(async () => {
    await clearDatabase();
    fixtures = await seedDatabase();
    ioRef.current = null;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await stopApollo?.();
    await mongoose.disconnect();
  });

  async function graphqlRequest<TData>(options: {
    query: string;
    variables?: Record<string, unknown>;
    userId?: string;
    socketId?: string;
  }) {
    const req = api
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: options.query,
        variables: options.variables,
      });

    if (options.userId) {
      req.set('x-user-id', options.userId);
    }
    if (options.socketId) {
      req.set('x-socket-id', options.socketId);
    }

    const response = await req;
    expect(response.status).toBe(200);

    return response.body as {
      data?: TData;
      errors?: Array<{ message: string }>;
    };
  }

  it('returns health status', async () => {
    const response = await api.get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns seeded users sorted by username', async () => {
    const response = await graphqlRequest<{
      users: Array<{ username: string; displayName: string }>;
    }>({
      query: 'query { users { username displayName } }',
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.users).toEqual([
      { username: 'alice', displayName: 'Alice Chen' },
      { username: 'bob', displayName: 'Bob Smith' },
      { username: 'carol', displayName: 'Carol Wang' },
      { username: 'dave', displayName: 'Dave Kim' },
    ]);
  });

  it('returns channels with unread counts and last messages', async () => {
    const response = await graphqlRequest<{
      channels: Array<{
        id: string;
        name: string;
        type: string;
        unreadCount: number;
        lastMessage: { content: string } | null;
        members: Array<{ id: string; displayName: string }>;
      }>;
    }>({
      query:
        'query { channels { id name type unreadCount lastMessage { content } members { id displayName } } }',
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.channels).toHaveLength(4);

    const shareYourStoryChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.shareYourStory._id.toString(),
    );
    const productTeamChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.productTeam._id.toString(),
    );
    const dmAliceBobChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.dmAliceBob._id.toString(),
    );
    const dmAliceCarolChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.dmAliceCarol._id.toString(),
    );
    const groupCount = response.data?.channels.filter((channel) => channel.type === 'group').length;
    const dmCount = response.data?.channels.filter((channel) => channel.type === 'dm').length;

    expect(shareYourStoryChannel?.name).toBe('Share your story');
    expect(productTeamChannel?.name).toBe('Product team');
    expect(groupCount).toBe(2);
    expect(dmCount).toBe(2);
    expect(dmAliceBobChannel?.type).toBe('dm');
    expect(dmAliceBobChannel?.members.map((member) => member.displayName).sort()).toEqual([
      'Alice Chen',
      'Bob Smith',
    ]);
    expect(dmAliceCarolChannel?.type).toBe('dm');
    expect(dmAliceCarolChannel?.members.map((member) => member.displayName).sort()).toEqual([
      'Alice Chen',
      'Carol Wang',
    ]);
    expect(
      response.data?.channels.some(
        (channel) => channel.id === fixtures.channels.dmCarolDave._id.toString(),
      ),
    ).toBe(false);
    expect(shareYourStoryChannel?.unreadCount).toBe(fixtures.messages.shareYourStory.length);
    expect(productTeamChannel?.unreadCount).toBe(fixtures.messages.productTeam.length);
    expect(dmAliceBobChannel?.unreadCount).toBe(fixtures.messages.dmAliceBob.length);
    expect(dmAliceCarolChannel?.unreadCount).toBe(fixtures.messages.dmAliceCarol.length);
    expect(
      response.data?.channels.every((channel) => channel.lastMessage?.content),
    ).toBe(true);
  });

  it('rejects message queries for channels the current user does not belong to', async () => {
    const response = await graphqlRequest<{
      messages: Array<{ id: string }>;
    }>({
      query: 'query($channelId: ID!) { messages(channelId: $channelId) { id } }',
      variables: {
        channelId: fixtures.channels.dmCarolDave._id.toString(),
      },
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.data).toBeNull();
    expect(response.errors?.[0]?.message).toBe('Channel not found or access denied');
  });

  it('returns channel messages in chronological order with reply data', async () => {
    const response = await graphqlRequest<{
      messages: Array<{ id: string; replyTo: { id: string } | null }>;
    }>({
      query:
        'query($channelId: ID!, $limit: Int) { messages(channelId: $channelId, limit: $limit) { id replyTo { id } } }',
      variables: {
        channelId: fixtures.channels.productTeam._id.toString(),
        limit: fixtures.messages.productTeam.length,
      },
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.messages).toHaveLength(fixtures.messages.productTeam.length);
    expect(response.data?.messages.map((message) => message.id)).toEqual(
      fixtures.messages.productTeam.map((message) => message._id.toString()),
    );

    const expectedReplyMessage = fixtures.messages.productTeam.find((message) => message.replyToId);
    const actualReplyMessage = response.data?.messages.find(
      (message) => message.id === expectedReplyMessage?._id.toString(),
    );

    expect(actualReplyMessage?.replyTo?.id).toBe(expectedReplyMessage?.replyToId?.toString());
  });

  it('creates a message for the current user', async () => {
    const response = await graphqlRequest<{
      sendMessage: {
        content: string;
        sender: { username: string };
        channel: { name: string };
        mentions: Array<{ username: string }>;
      };
    }>({
      query:
        'mutation($input: SendMessageInput!) { sendMessage(input: $input) { content sender { username } channel { name } mentions { username } } }',
      variables: {
        input: {
          channelId: fixtures.channels.shareYourStory._id.toString(),
          content: 'backend test message',
          mentions: [
            fixtures.users.alice._id.toString(),
            fixtures.users.carol._id.toString(),
            fixtures.users.alice._id.toString(),
          ],
        },
      },
      userId: fixtures.users.bob._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.sendMessage).toEqual({
      content: 'backend test message',
      sender: { username: 'bob' },
      channel: { name: 'Share your story' },
      mentions: [{ username: 'alice' }, { username: 'carol' }],
    });
  });

  it('creates a quoted reply with replyTo data', async () => {
    const replyTarget = fixtures.messages.productTeam.find((message) => !message.replyToId);
    const replySender = Object.values(fixtures.users).find(
      (user) => user._id.toString() === replyTarget?.senderId.toString(),
    );

    expect(replyTarget).toBeDefined();
    expect(replySender).toBeDefined();

    const response = await graphqlRequest<{
      sendMessage: {
        content: string;
        replyTo: {
          id: string;
          content: string;
          sender: { displayName: string };
        } | null;
      };
    }>({
      query:
        'mutation($input: SendMessageInput!) { sendMessage(input: $input) { content replyTo { id content sender { displayName } } } }',
      variables: {
        input: {
          channelId: fixtures.channels.productTeam._id.toString(),
          content: 'quoted reply from test',
          replyTo: replyTarget?._id.toString(),
        },
      },
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.sendMessage).toEqual({
      content: 'quoted reply from test',
      replyTo: {
        id: replyTarget!._id.toString(),
        content: replyTarget!.content,
        sender: {
          displayName: replySender!.displayName,
        },
      },
    });
  });

  it('emits new_message to the channel when sendMessage succeeds', async () => {
    const channelId = fixtures.channels.shareYourStory._id.toString();
    const socketId = 'socket-123';
    const emit = vi.fn();
    const except = vi.fn(() => ({ emit }));
    const to = vi.fn(() => ({ except, emit }));

    ioRef.current = { to } as never;

    const response = await graphqlRequest<{
      sendMessage: {
        id: string;
        content: string;
      };
    }>({
      query: 'mutation($input: SendMessageInput!) { sendMessage(input: $input) { id content } }',
      variables: {
        input: {
          channelId,
          content: 'broadcast this message',
          mentions: [fixtures.users.alice._id.toString()],
        },
      },
      userId: fixtures.users.bob._id.toString(),
      socketId,
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.sendMessage.content).toBe('broadcast this message');
    expect(to).toHaveBeenCalledWith(channelId);
    expect(except).toHaveBeenCalledWith(socketId);
    expect(emit).toHaveBeenCalledWith(
      'new_message',
      expect.objectContaining({
        channelId,
        message: expect.objectContaining({
          id: response.data?.sendMessage.id,
          content: 'broadcast this message',
          mentions: [
            {
              id: fixtures.users.alice._id.toString(),
              username: 'alice',
              displayName: 'Alice Chen',
            },
          ],
          sender: expect.objectContaining({
            id: fixtures.users.bob._id.toString(),
            username: 'bob',
            displayName: 'Bob Smith',
          }),
        }),
      }),
    );
  });

  it('emits quoted reply payload when sendMessage succeeds', async () => {
    const channelId = fixtures.channels.productTeam._id.toString();
    const socketId = 'socket-456';
    const emit = vi.fn();
    const except = vi.fn(() => ({ emit }));
    const to = vi.fn(() => ({ except, emit }));
    const replyTarget = fixtures.messages.productTeam.find((message) => !message.replyToId);
    const replySender = Object.values(fixtures.users).find(
      (user) => user._id.toString() === replyTarget?.senderId.toString(),
    );

    expect(replyTarget).toBeDefined();
    expect(replySender).toBeDefined();

    ioRef.current = { to } as never;

    const response = await graphqlRequest<{
      sendMessage: {
        id: string;
        content: string;
      };
    }>({
      query: 'mutation($input: SendMessageInput!) { sendMessage(input: $input) { id content } }',
      variables: {
        input: {
          channelId,
          content: 'broadcast quoted reply',
          replyTo: replyTarget?._id.toString(),
        },
      },
      userId: fixtures.users.alice._id.toString(),
      socketId,
    });

    expect(response.errors).toBeUndefined();
    expect(to).toHaveBeenCalledWith(channelId);
    expect(except).toHaveBeenCalledWith(socketId);
    expect(emit).toHaveBeenCalledWith(
      'new_message',
      expect.objectContaining({
        channelId,
        message: expect.objectContaining({
          id: response.data?.sendMessage.id,
          content: 'broadcast quoted reply',
          replyTo: {
            id: replyTarget!._id.toString(),
            content: replyTarget!.content,
            sender: {
              id: replySender!._id.toString(),
              displayName: replySender!.displayName,
            },
          },
        }),
      }),
    );
  });

  it('rejects sendMessage when mentioned users are outside the channel', async () => {
    const response = await graphqlRequest<{
      sendMessage: { id: string };
    }>({
      query:
        'mutation($input: SendMessageInput!) { sendMessage(input: $input) { id } }',
      variables: {
        input: {
          channelId: fixtures.channels.dmAliceBob._id.toString(),
          content: 'should fail',
          mentions: [fixtures.users.carol._id.toString()],
        },
      },
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.data).toBeNull();
    expect(response.errors?.[0]?.message).toBe('Mentioned users must belong to the channel');
  });

  it('rejects sendMessage for channels the current user does not belong to', async () => {
    const response = await graphqlRequest<{
      sendMessage: { id: string };
    }>({
      query:
        'mutation($input: SendMessageInput!) { sendMessage(input: $input) { id } }',
      variables: {
        input: {
          channelId: fixtures.channels.dmCarolDave._id.toString(),
          content: 'should fail',
        },
      },
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.data).toBeNull();
    expect(response.errors?.[0]?.message).toBe('Channel not found or access denied');
  });

  it('rejects sendMessage without x-user-id', async () => {
    const response = await graphqlRequest({
      query:
        'mutation($input: SendMessageInput!) { sendMessage(input: $input) { id } }',
      variables: {
        input: {
          channelId: fixtures.channels.shareYourStory._id.toString(),
          content: 'should fail',
        },
      },
    });

    expect(response.data).toBeNull();
    expect(response.errors?.[0]?.message).toBe('x-user-id header is required');
  });

  it('updates unread count after markAsRead', async () => {
    const userId = fixtures.users.alice._id.toString();
    const channelId = fixtures.channels.shareYourStory._id.toString();
    const latestChannelMessageId =
      fixtures.messages.shareYourStory[fixtures.messages.shareYourStory.length - 1]._id.toString();

    const beforeResponse = await graphqlRequest<{
      channels: Array<{ id: string; unreadCount: number }>;
    }>({
      query: 'query { channels { id unreadCount } }',
      userId,
    });

    const beforeChannel = beforeResponse.data?.channels.find(
      (channel) => channel.id === channelId,
    );
    expect(beforeChannel?.unreadCount).toBe(fixtures.messages.shareYourStory.length);

    const mutationResponse = await graphqlRequest<{
      markAsRead: boolean;
    }>({
      query:
        'mutation($channelId: ID!, $messageId: ID!) { markAsRead(channelId: $channelId, messageId: $messageId) }',
      variables: {
        channelId,
        messageId: latestChannelMessageId,
      },
      userId,
    });

    expect(mutationResponse.errors).toBeUndefined();
    expect(mutationResponse.data?.markAsRead).toBe(true);

    const afterResponse = await graphqlRequest<{
      channels: Array<{ id: string; unreadCount: number }>;
    }>({
      query: 'query { channels { id unreadCount } }',
      userId,
    });

    const afterChannel = afterResponse.data?.channels.find(
      (channel) => channel.id === channelId,
    );
    expect(afterChannel?.unreadCount).toBe(0);
  });

  it('rejects markAsRead when messageId is outside the channel', async () => {
    const userId = fixtures.users.alice._id.toString();
    const channelId = fixtures.channels.shareYourStory._id.toString();
    const foreignMessageId = fixtures.messages.dmAliceBob[0]._id.toString();

    const response = await graphqlRequest<{
      markAsRead: boolean;
    }>({
      query:
        'mutation($channelId: ID!, $messageId: ID!) { markAsRead(channelId: $channelId, messageId: $messageId) }',
      variables: {
        channelId,
        messageId: foreignMessageId,
      },
      userId,
    });

    expect(response.data).toBeNull();
    expect(response.errors?.[0]?.message).toBe('Message not found in channel');

    const afterResponse = await graphqlRequest<{
      channels: Array<{ id: string; unreadCount: number }>;
    }>({
      query: 'query { channels { id unreadCount } }',
      userId,
    });

    const afterChannel = afterResponse.data?.channels.find(
      (channel) => channel.id === channelId,
    );
    expect(afterChannel?.unreadCount).toBe(fixtures.messages.shareYourStory.length);
  });
});
