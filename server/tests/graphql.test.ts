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
        name: string;
        unreadCount: number;
        lastMessage: { content: string } | null;
      }>;
    }>({
      query:
        'query { channels { name unreadCount lastMessage { content } } }',
      userId: fixtures.users.alice._id.toString(),
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.channels).toHaveLength(3);
    expect(response.data?.channels.map((channel) => channel.name)).toEqual([
      'design',
      'engineering',
      'general',
    ]);
    expect(response.data?.channels.every((channel) => channel.unreadCount === 6)).toBe(
      true,
    );
    expect(
      response.data?.channels.every((channel) => channel.lastMessage?.content),
    ).toBe(true);
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
      channel: { name: 'general' },
    });
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
