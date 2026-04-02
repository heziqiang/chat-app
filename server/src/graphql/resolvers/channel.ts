import { Types } from 'mongoose';
import { Channel, Message, ReadStatus } from '../../models';
import type { IChannel } from '../../models';
import type { GqlContext } from '../index';

export const channelResolvers = {
  Query: {
    channels: async () => {
      return Channel.find().sort({ name: 1 });
    },
  },

  Channel: {
    id: (parent: IChannel) => parent._id.toString(),

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
