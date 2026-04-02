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
    design: ChannelDoc;
  };
  messages: {
    general: MessageDoc[];
    engineering: MessageDoc[];
    design: MessageDoc[];
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
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=alice',
      title: 'CTO @ Gradual',
    },
    {
      username: 'bob',
      displayName: 'Bob Smith',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=bob',
      title: 'Senior Engineer',
    },
    {
      username: 'carol',
      displayName: 'Carol Wang',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=carol',
      title: 'Product Manager',
    },
    {
      username: 'dave',
      displayName: 'Dave Kim',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=dave',
      title: 'Designer',
    },
  ]);
  console.log(`Seeded ${4} users`);

  const [general, engineering, design] = await Channel.insertMany([
    {
      name: 'general',
      avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=general',
    },
    {
      name: 'engineering',
      avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=engineering',
    },
    {
      name: 'design',
      avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=design',
    },
  ]);
  console.log(`Seeded ${3} channels`);

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

  const designMsgs = await sendMessages([
    { channelId: design._id, senderId: dave._id, content: 'Uploaded the new channel list mockups to Figma.' },
    { channelId: design._id, senderId: carol._id, content: 'Love the unread badge placement. Very clean.' },
    { channelId: design._id, senderId: dave._id, content: 'Thanks! I also updated the message bubble spacing.' },
    { channelId: design._id, senderId: alice._id, content: 'Can we add a hover state for the reply button?' },
    { channelId: design._id, senderId: dave._id, content: 'Good call, I\'ll add that in the next iteration.' },
  ]);
  await sendMessages([
    {
      channelId: design._id,
      senderId: carol._id,
      content: 'Agreed, subtle hover feedback would be great.',
      replyToId: designMsgs[3]._id,
    },
  ]);

  const totalMessages = await Message.countDocuments();
  console.log(`Seeded ${totalMessages} messages (including 2 quote replies)`);

  return {
    users: { alice, bob, carol, dave },
    channels: { general, engineering, design },
    messages: {
      general: generalMsgs,
      engineering: await Message.find({ channelId: engineering._id }).sort({ _id: 1 }),
      design: await Message.find({ channelId: design._id }).sort({ _id: 1 }),
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
