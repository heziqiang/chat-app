import { Types } from 'mongoose';
import { Channel, Message, ReadStatus, User } from '../../models';
import type { IChannel } from '../../models';
import type { GqlContext } from '../index';

export function requireUserId(context: GqlContext) {
  if (!context.userId) {
    throw new Error('x-user-id header is required');
  }

  return context.userId;
}

export async function requireChannelAccess(
  channelId: string | Types.ObjectId,
  context: GqlContext,
) {
  const userId = requireUserId(context);
  const normalizedChannelId =
    typeof channelId === 'string' ? new Types.ObjectId(channelId) : channelId;

  const channel = await Channel.findOne({
    _id: normalizedChannelId,
    memberUserIds: new Types.ObjectId(userId),
  });

  if (!channel) {
    throw new Error('Channel not found or access denied');
  }

  return { channel, userId };
}

export const channelResolvers = {
  Query: {
    channels: async (_: unknown, __: unknown, context: GqlContext) => {
      const userId = requireUserId(context);

      return Channel.find({
        memberUserIds: new Types.ObjectId(userId),
      }).sort({ name: 1 });
    },
  },

  Channel: {
    id: (parent: IChannel) => parent._id.toString(),

    members: async (parent: IChannel) => {
      if (!parent.memberUserIds?.length) return [];
      return User.find({ _id: { $in: parent.memberUserIds } });
    },

    lastMessage: async (parent: IChannel) => {
      return Message.findOne({ channelId: parent._id }).sort({ _id: -1 });
    },

    unreadCount: async (parent: IChannel, _: unknown, context: GqlContext) => {
      if (!context.userId) return 0;

      const readStatus = await ReadStatus.findOne({
        userId: new Types.ObjectId(context.userId),
        channelId: parent._id,
      });

      const filter: Record<string, unknown> = { channelId: parent._id };
      if (readStatus?.lastReadMessageId) {
        filter._id = { $gt: readStatus.lastReadMessageId };
      }

      return Message.countDocuments(filter);
    },
  },
};
