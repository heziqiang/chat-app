import mongoose from 'mongoose';
import request, { type SuperTest, type Test } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, connectToDatabase, syncModelIndexes } from '../src/index';
import {
  clearDatabase,
  seedDatabase,
  type SeedFixtures,
} from '../src/seed';

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/gradual-chat-test';

describe('GraphQL API', () => {
  let api: SuperTest<Test>;
  let fixtures: SeedFixtures;
  let stopApollo: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    await connectToDatabase(TEST_MONGODB_URI);
    await syncModelIndexes();

    const { app, apollo } = await createApp();
    api = request(app);
    stopApollo = () => apollo.stop();
  });

  beforeEach(async () => {
    await clearDatabase();
    fixtures = await seedDatabase();
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

    const generalChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.general._id.toString(),
    );
    const engineeringChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.engineering._id.toString(),
    );
    const dmAliceBobChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.dmAliceBob._id.toString(),
    );
    const dmAliceCarolChannel = response.data?.channels.find(
      (channel) => channel.id === fixtures.channels.dmAliceCarol._id.toString(),
    );
    const groupCount = response.data?.channels.filter((channel) => channel.type === 'group').length;
    const dmCount = response.data?.channels.filter((channel) => channel.type === 'dm').length;

    expect(generalChannel?.name).toBe('General');
    expect(engineeringChannel?.name).toBe('Engineering');
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
    expect(generalChannel?.unreadCount).toBe(6);
    expect(engineeringChannel?.unreadCount).toBe(6);
    expect(dmAliceBobChannel?.unreadCount).toBe(4);
    expect(dmAliceCarolChannel?.unreadCount).toBe(4);
    expect(
      response.data?.channels.every((channel) => channel.lastMessage?.content),
    ).toBe(true);
  });

  it('seeds each user with more DMs than groups', async () => {
    const responses = await Promise.all(
      Object.values(fixtures.users).map((user) =>
        graphqlRequest<{
          channels: Array<{ type: string }>;
        }>({
          query: 'query { channels { type } }',
          userId: user._id.toString(),
        }),
      ),
    );

    for (const response of responses) {
      expect(response.errors).toBeUndefined();

      const dmCount = response.data?.channels.filter((channel) => channel.type === 'dm').length ?? 0;
      const groupCount =
        response.data?.channels.filter((channel) => channel.type === 'group').length ?? 0;

      expect(dmCount).toBeGreaterThanOrEqual(2);
      expect(dmCount).toBeLessThanOrEqual(3);
      expect(groupCount).toBeGreaterThanOrEqual(1);
      expect(groupCount).toBeLessThanOrEqual(2);
      expect(dmCount).toBeGreaterThanOrEqual(groupCount);
    }
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
      messages: Array<{ content: string; replyTo: { content: string } | null }>;
    }>({
      query:
        'query($channelId: ID!) { messages(channelId: $channelId) { content replyTo { content } } }',
      variables: {
        channelId: fixtures.channels.engineering._id.toString(),
      },
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.messages).toHaveLength(6);
    expect(response.data?.messages[0]?.content).toBe(
      'Deployed v2.1 to staging. Please smoke test when you get a chance.',
    );
    expect(response.data?.messages[5]?.replyTo?.content).toBe(
      'WebSocket reconnect has a small race condition, working on a fix.',
    );
  });

  it('creates a message for the current user', async () => {
    const response = await graphqlRequest<{
      sendMessage: {
        content: string;
        sender: { username: string };
        channel: { name: string };
      };
    }>({
      query:
        'mutation($input: SendMessageInput!) { sendMessage(input: $input) { content sender { username } channel { name } } }',
      variables: {
        input: {
          channelId: fixtures.channels.general._id.toString(),
          content: 'backend test message',
        },
      },
      userId: fixtures.users.bob._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.sendMessage).toEqual({
      content: 'backend test message',
      sender: { username: 'bob' },
      channel: { name: 'General' },
    });
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
          channelId: fixtures.channels.general._id.toString(),
          content: 'should fail',
        },
      },
    });

    expect(response.data).toBeNull();
    expect(response.errors?.[0]?.message).toBe('x-user-id header is required');
  });

  it('updates unread count after markAsRead', async () => {
    const userId = fixtures.users.alice._id.toString();
    const channelId = fixtures.channels.general._id.toString();
    const latestGeneralMessageId =
      fixtures.messages.general[fixtures.messages.general.length - 1]._id.toString();

    const beforeResponse = await graphqlRequest<{
      channels: Array<{ id: string; unreadCount: number }>;
    }>({
      query: 'query { channels { id unreadCount } }',
      userId,
    });

    const beforeChannel = beforeResponse.data?.channels.find(
      (channel) => channel.id === channelId,
    );
    expect(beforeChannel?.unreadCount).toBe(6);

    const mutationResponse = await graphqlRequest<{
      markAsRead: boolean;
    }>({
      query:
        'mutation($channelId: ID!, $messageId: ID!) { markAsRead(channelId: $channelId, messageId: $messageId) }',
      variables: {
        channelId,
        messageId: latestGeneralMessageId,
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
});
