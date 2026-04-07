import '../loadEnv';
import mongoose from 'mongoose';
import { User, Channel, Message, ReadStatus } from '../models';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/gradual-chat';

const GROUP_MESSAGE_COUNTS = {
  shareYourStory: 24,
  productTeam: 72,
} as const;

const DM_MESSAGE_COUNTS = {
  dmAliceBob: 4,
  dmAliceCarol: 4,
  dmBobCarol: 5,
  dmBobDave: 3,
  dmCarolDave: 4,
} as const;

const STORY_PARTS = {
  starts: [
    'I moved into tech from support',
    'My first startup job was on a tiny team',
    'A side project is what got me into product',
    'Switching out of agency work changed everything for me',
    'The biggest turning point in my career was a messy launch',
  ],
  middles: [
    'and it taught me to stay close to customer pain',
    'so now I ask more questions before proposing changes',
    'and it made quick feedback feel normal',
    'which is why I care a lot about simple workflows',
    'and it forced me to get comfortable with ambiguity',
  ],
  ends: [
    'That habit still helps every week.',
    'I still fall back to that when a project gets noisy.',
    'It changed how I work with engineers.',
    'That is probably why I prefer small iterations.',
    'It made collaboration much easier for me.',
  ],
} as const;

const PRODUCT_PARTS = {
  starts: [
    'The new onboarding flow',
    'The setup checklist',
    'The welcome screen copy',
    'The progress indicator',
    'The empty state in setup',
    'The activation email',
  ],
  middles: [
    'feels clearer after the last round',
    'still needs one more pass',
    'looks better with the shorter copy',
    'is much easier to scan now',
    'still feels a bit heavy on mobile',
    'is close but not fully there yet',
  ],
  ends: [
    'I think new users will notice the difference.',
    'We should keep the next change small.',
    'QA can probably verify this quickly.',
    'The current draft is good enough for another round.',
    'I would rather ship this than reopen the whole flow.',
    'The handoff to engineering looks straightforward.',
  ],
} as const;

const DM_TOPICS = [
  'the message list spacing',
  'the empty state copy',
  'the avatar crop',
  'the channel header',
  'the composer padding',
  'the onboarding draft',
  'the group intro text',
] as const;

const DM_OPENERS = [
  'Do you have a minute to check',
  'Can you take a quick look at',
  'Are you around to review',
  'Mind taking a pass at',
  'Could you glance at',
  'Can you sanity-check',
] as const;

const DM_RESPONSES = [
  'Sure, I am looking now',
  'Yep, opening it now',
  'I can check it now',
  'Yes, give me a minute',
  'On it',
  'I am in the file already',
] as const;

const DM_NOTES = [
  'The latest version feels better already',
  'I only changed a couple of small things',
  'The mobile view is the part I am unsure about',
  'It is mostly fine, just a little tight on smaller screens',
  'I think we are close',
  'The main structure feels right now',
 ] as const;

const DM_CLOSERS = [
  'Looks good to me',
  'I would ship this version',
  'Let me make one tiny adjustment and send it back',
  'The latest version works for me',
  'This feels ready enough for now',
  'I think this is in a good place',
] as const;

const DM_SIGN_OFFS = [
  'Nice, thanks',
  'Perfect, appreciate it',
  'Great, that helps',
  'Sounds good',
  'Awesome, thank you',
  'That is enough for me',
] as const;

type MessageSeed = {
  _id: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  replyToId: mongoose.Types.ObjectId | null;
  mentionUserIds: mongoose.Types.ObjectId[];
};

type Participant = {
  _id: mongoose.Types.ObjectId;
};

const pickRandom = <T>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

const createMessageSeed = (input: {
  channelId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  replyToId?: mongoose.Types.ObjectId | null;
}): MessageSeed => ({
  _id: new mongoose.Types.ObjectId(),
  channelId: input.channelId,
  senderId: input.senderId,
  content: input.content,
  replyToId: input.replyToId ?? null,
  mentionUserIds: [],
});

const buildTopicMessage = (parts: {
  starts: readonly string[];
  middles: readonly string[];
  ends: readonly string[];
}) => `${pickRandom(parts.starts)} ${pickRandom(parts.middles)}. ${pickRandom(parts.ends)}`;

const buildGroupMessages = (options: {
  channelId: mongoose.Types.ObjectId;
  participants: Participant[];
  count: number;
  parts: {
    starts: readonly string[];
    middles: readonly string[];
    ends: readonly string[];
  };
  includeReply?: boolean;
}) => {
  const baseCount = options.includeReply ? options.count - 1 : options.count;
  const messages = Array.from({ length: baseCount }, () =>
    createMessageSeed({
      channelId: options.channelId,
      senderId: pickRandom(options.participants)._id,
      content: buildTopicMessage(options.parts),
    }),
  );

  if (options.includeReply && messages.length > 0) {
    const replyTarget = messages[Math.floor(messages.length / 2)];
    messages.push(
      createMessageSeed({
        channelId: options.channelId,
        senderId: pickRandom(options.participants)._id,
        content: `I agree, especially around ${pickRandom(options.parts.starts).toLowerCase()}.`,
        replyToId: replyTarget._id,
      }),
    );
  }

  return messages;
};

const buildDmMessages = (options: {
  channelId: mongoose.Types.ObjectId;
  participants: [Participant, Participant];
  count: number;
}) => {
  const topic = pickRandom(DM_TOPICS);
  const lines = [
    `${pickRandom(DM_OPENERS)} ${topic}?`,
    `${pickRandom(DM_RESPONSES)}.`,
    `${pickRandom(DM_NOTES)}.`,
    `${pickRandom(DM_CLOSERS)}.`,
    `${pickRandom(DM_SIGN_OFFS)}.`,
  ];

  return Array.from({ length: options.count }, (_, index) =>
    createMessageSeed({
      channelId: options.channelId,
      senderId: options.participants[index % options.participants.length]._id,
      content: lines[index] ?? `${pickRandom(DM_SIGN_OFFS)}.`,
    }),
  );
};

export async function clearDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Channel.deleteMany({}),
    Message.deleteMany({}),
    ReadStatus.deleteMany({}),
  ]);
  console.log('Cleared existing data');
}

export async function seedDatabase() {
  const [alice, bob, carol, dave] = await User.insertMany([
    { username: 'alice', displayName: 'Alice Chen', avatarUrl: 'https://i.pravatar.cc/150?img=47', title: 'CTO' },
    { username: 'bob', displayName: 'Bob Smith', avatarUrl: 'https://i.pravatar.cc/150?img=12', title: 'Senior Engineer' },
    { username: 'carol', displayName: 'Carol Wang', avatarUrl: 'https://i.pravatar.cc/150?img=44', title: 'Product Manager' },
    { username: 'dave', displayName: 'Dave Kim', avatarUrl: 'https://i.pravatar.cc/150?img=11', title: 'Designer' },
  ]);
  console.log('Seeded 4 users');

  const [shareYourStory, productTeam] = await Channel.insertMany([
    { name: 'Share your story', type: 'group', memberUserIds: [alice._id, bob._id, carol._id, dave._id] },
    { name: 'Product team', type: 'group', memberUserIds: [alice._id, bob._id, carol._id, dave._id] },
  ]);

  const [dmAliceBob, dmAliceCarol, dmBobCarol, dmBobDave, dmCarolDave] = await Channel.insertMany([
    { type: 'dm', memberUserIds: [alice._id, bob._id] },
    { type: 'dm', memberUserIds: [alice._id, carol._id] },
    { type: 'dm', memberUserIds: [bob._id, carol._id] },
    { type: 'dm', memberUserIds: [bob._id, dave._id] },
    { type: 'dm', memberUserIds: [carol._id, dave._id] },
  ]);
  console.log('Seeded 7 channels (2 group + 5 dm)');

  const users = { alice, bob, carol, dave };

  const shareYourStoryMessages = await Message.insertMany(
    buildGroupMessages({
      channelId: shareYourStory._id,
      participants: [alice, bob, carol, dave],
      count: GROUP_MESSAGE_COUNTS.shareYourStory,
      parts: STORY_PARTS,
    }),
  );

  const productTeamMessages = await Message.insertMany(
    buildGroupMessages({
      channelId: productTeam._id,
      participants: [alice, bob, carol, dave],
      count: GROUP_MESSAGE_COUNTS.productTeam,
      parts: PRODUCT_PARTS,
      includeReply: true,
    }),
  );

  const dmAliceBobMessages = await Message.insertMany(
    buildDmMessages({
      channelId: dmAliceBob._id,
      participants: [users.alice, users.bob],
      count: DM_MESSAGE_COUNTS.dmAliceBob,
    }),
  );

  const dmAliceCarolMessages = await Message.insertMany(
    buildDmMessages({
      channelId: dmAliceCarol._id,
      participants: [users.alice, users.carol],
      count: DM_MESSAGE_COUNTS.dmAliceCarol,
    }),
  );

  const dmBobCarolMessages = await Message.insertMany(
    buildDmMessages({
      channelId: dmBobCarol._id,
      participants: [users.bob, users.carol],
      count: DM_MESSAGE_COUNTS.dmBobCarol,
    }),
  );

  const dmBobDaveMessages = await Message.insertMany(
    buildDmMessages({
      channelId: dmBobDave._id,
      participants: [users.bob, users.dave],
      count: DM_MESSAGE_COUNTS.dmBobDave,
    }),
  );

  const dmCarolDaveMessages = await Message.insertMany(
    buildDmMessages({
      channelId: dmCarolDave._id,
      participants: [users.carol, users.dave],
      count: DM_MESSAGE_COUNTS.dmCarolDave,
    }),
  );

  const totalMessages = await Message.countDocuments();
  console.log(`Seeded ${totalMessages} messages`);

  return {
    users,
    channels: {
      shareYourStory,
      productTeam,
      dmAliceBob,
      dmAliceCarol,
      dmBobCarol,
      dmBobDave,
      dmCarolDave,
    },
    messages: {
      shareYourStory: shareYourStoryMessages,
      productTeam: productTeamMessages,
      dmAliceBob: dmAliceBobMessages,
      dmAliceCarol: dmAliceCarolMessages,
      dmBobCarol: dmBobCarolMessages,
      dmBobDave: dmBobDaveMessages,
      dmCarolDave: dmCarolDaveMessages,
    },
  };
}

export async function runSeed(uri = MONGODB_URI) {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await clearDatabase();
  const fixtures = await seedDatabase();

  await mongoose.disconnect();
  console.log('Seed complete');

  return fixtures;
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
