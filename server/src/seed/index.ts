import mongoose, { type HydratedDocument } from 'mongoose';
import { User, Channel, Message, ReadStatus } from '../models';
import type { IUser, IChannel, IMessage } from '../models';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/gradual-chat';

type UserDoc = HydratedDocument<IUser>;
type ChannelDoc = HydratedDocument<IChannel>;
type MessageDoc = HydratedDocument<IMessage>;

export interface SeedFixtures {
  users: {
    alice: UserDoc;
    bob: UserDoc;
    carol: UserDoc;
    dave: UserDoc;
  };
  channels: {
    general: ChannelDoc;
    engineering: ChannelDoc;
    dmAliceBob: ChannelDoc;
    dmAliceCarol: ChannelDoc;
    dmBobCarol: ChannelDoc;
    dmBobDave: ChannelDoc;
    dmCarolDave: ChannelDoc;
  };
  messages: {
    general: MessageDoc[];
    engineering: MessageDoc[];
    dmAliceBob: MessageDoc[];
    dmAliceCarol: MessageDoc[];
    dmBobCarol: MessageDoc[];
    dmBobDave: MessageDoc[];
    dmCarolDave: MessageDoc[];
  };
}

export async function clearDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Channel.deleteMany({}),
    Message.deleteMany({}),
    ReadStatus.deleteMany({}),
  ]);
  console.log('Cleared existing data');
}

export async function seedDatabase(): Promise<SeedFixtures> {
  const sendMessages = async (
    items: {
      channelId: mongoose.Types.ObjectId;
      senderId: mongoose.Types.ObjectId;
      content: string;
      replyToId?: mongoose.Types.ObjectId;
    }[],
  ): Promise<MessageDoc[]> => {
    const created: MessageDoc[] = [];
    for (const item of items) {
      const msg = await Message.create(item);
      created.push(msg);
    }
    return created;
  };

  const [alice, bob, carol, dave] = await User.insertMany([
    {
      username: 'alice',
      displayName: 'Alice Chen',
      avatarUrl: 'https://i.pravatar.cc/150?img=47',
      title: 'CTO @ Gradual',
    },
    {
      username: 'bob',
      displayName: 'Bob Smith',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
      title: 'Senior Engineer',
    },
    {
      username: 'carol',
      displayName: 'Carol Wang',
      avatarUrl: 'https://i.pravatar.cc/150?img=44',
      title: 'Product Manager',
    },
    {
      username: 'dave',
      displayName: 'Dave Kim',
      avatarUrl: 'https://i.pravatar.cc/150?img=11',
      title: 'Designer',
    },
  ]);
  console.log(`Seeded ${4} users`);

  const [general, engineering] = await Channel.insertMany([
    {
      name: 'General',
      type: 'group',
      memberUserIds: [alice._id, bob._id, carol._id, dave._id],
    },
    {
      name: 'Engineering',
      type: 'group',
      memberUserIds: [alice._id, bob._id, carol._id],
    },
  ]);

  // DM channels — no name, type: 'dm', exactly 2 members
  const [dmAliceBob, dmAliceCarol, dmBobCarol, dmBobDave, dmCarolDave] = await Channel.insertMany([
    {
      type: 'dm',
      memberUserIds: [alice._id, bob._id],
    },
    {
      type: 'dm',
      memberUserIds: [alice._id, carol._id],
    },
    {
      type: 'dm',
      memberUserIds: [bob._id, carol._id],
    },
    {
      type: 'dm',
      memberUserIds: [bob._id, dave._id],
    },
    {
      type: 'dm',
      memberUserIds: [carol._id, dave._id],
    },
  ]);
  console.log('Seeded 7 channels (2 group + 5 dm)');

  const generalMsgs = await sendMessages([
    { channelId: general._id, senderId: alice._id, content: 'Welcome to Gradual Chat! 🎉' },
    { channelId: general._id, senderId: bob._id, content: 'Hey everyone, excited to be here.' },
    { channelId: general._id, senderId: carol._id, content: 'Quick reminder: product sync is at 3pm today.' },
    { channelId: general._id, senderId: dave._id, content: 'Thanks Carol, I\'ll have the mockups ready by then.' },
    { channelId: general._id, senderId: alice._id, content: 'Great, looking forward to seeing the new designs.' },
    { channelId: general._id, senderId: bob._id, content: 'I pushed the API changes this morning, feel free to test.' },
  ]);

  const engMsgs = await sendMessages([
    { channelId: engineering._id, senderId: bob._id, content: 'Deployed v2.1 to staging. Please smoke test when you get a chance.' },
    { channelId: engineering._id, senderId: alice._id, content: 'On it. Any known issues?' },
    { channelId: engineering._id, senderId: bob._id, content: 'WebSocket reconnect has a small race condition, working on a fix.' },
    { channelId: engineering._id, senderId: carol._id, content: 'Is the pagination endpoint stable? Frontend team wants to integrate.' },
    { channelId: engineering._id, senderId: bob._id, content: 'Yes, cursor-based pagination is solid. Go ahead and integrate.' },
  ]);
  await sendMessages([
    {
      channelId: engineering._id,
      senderId: alice._id,
      content: 'Nice, I confirmed the fix on staging. Looks good to ship.',
      replyToId: engMsgs[2]._id,
    },
  ]);

  // DM: Alice <-> Bob
  const dmAliceBobMsgs = await sendMessages([
    { channelId: dmAliceBob._id, senderId: alice._id, content: 'Hey Bob, got a minute to chat about the deploy?' },
    { channelId: dmAliceBob._id, senderId: bob._id, content: 'Sure! What\'s up?' },
    { channelId: dmAliceBob._id, senderId: alice._id, content: 'Can you walk me through the rollback plan?' },
    { channelId: dmAliceBob._id, senderId: bob._id, content: 'Yeah, I documented it in the runbook. Let me send you the link.' },
  ]);

  // DM: Alice <-> Carol
  const dmAliceCarolMsgs = await sendMessages([
    {
      channelId: dmAliceCarol._id,
      senderId: alice._id,
      content: 'Want to tighten the agenda before tomorrow\'s product sync?',
    },
    {
      channelId: dmAliceCarol._id,
      senderId: carol._id,
      content: 'Yes. I can shorten the roadmap section and keep only decisions.',
    },
    {
      channelId: dmAliceCarol._id,
      senderId: alice._id,
      content: 'Perfect, let\'s spend most of the time on blockers and owners.',
    },
    {
      channelId: dmAliceCarol._id,
      senderId: carol._id,
      content: 'Sounds good. I\'ll update the doc before lunch.',
    },
  ]);

  // DM: Bob <-> Carol
  const dmBobCarolMsgs = await sendMessages([
    {
      channelId: dmBobCarol._id,
      senderId: bob._id,
      content: 'Pagination API is ready for QA.',
    },
    {
      channelId: dmBobCarol._id,
      senderId: carol._id,
      content: 'Nice. Any edge cases product should call out?',
    },
    {
      channelId: dmBobCarol._id,
      senderId: bob._id,
      content: 'Only stale cursors. I added a guard and a clearer error message.',
    },
    {
      channelId: dmBobCarol._id,
      senderId: carol._id,
      content: 'Great, I\'ll add that note to the release checklist.',
    },
  ]);

  // DM: Bob <-> Dave
  const dmBobDaveMsgs = await sendMessages([
    {
      channelId: dmBobDave._id,
      senderId: dave._id,
      content: 'Can you send me a staging build with the updated sidebar spacing?',
    },
    {
      channelId: dmBobDave._id,
      senderId: bob._id,
      content: 'Just deployed one. A hard refresh should pick it up.',
    },
    {
      channelId: dmBobDave._id,
      senderId: dave._id,
      content: 'Seeing it now. The channel rows feel much cleaner.',
    },
  ]);

  // DM: Carol <-> Dave
  const dmCarolDaveMsgs = await sendMessages([
    { channelId: dmCarolDave._id, senderId: carol._id, content: 'Dave, the new mockups look amazing!' },
    { channelId: dmCarolDave._id, senderId: dave._id, content: 'Thanks Carol! Any feedback on the color palette?' },
    { channelId: dmCarolDave._id, senderId: carol._id, content: 'Maybe slightly warmer tones for the sidebar? Otherwise perfect.' },
  ]);

  const totalMessages = await Message.countDocuments();
  console.log(`Seeded ${totalMessages} messages (including 2 quote replies)`);

  return {
    users: { alice, bob, carol, dave },
    channels: {
      general,
      engineering,
      dmAliceBob,
      dmAliceCarol,
      dmBobCarol,
      dmBobDave,
      dmCarolDave,
    },
    messages: {
      general: generalMsgs,
      engineering: await Message.find({ channelId: engineering._id }).sort({ _id: 1 }),
      dmAliceBob: dmAliceBobMsgs,
      dmAliceCarol: dmAliceCarolMsgs,
      dmBobCarol: dmBobCarolMsgs,
      dmBobDave: dmBobDaveMsgs,
      dmCarolDave: dmCarolDaveMsgs,
    },
  };
}

export async function runSeed(uri = MONGODB_URI) {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await clearDatabase();
  const fixtures = await seedDatabase();

  await mongoose.disconnect();
  console.log('Seed complete ✓');

  return fixtures;
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
