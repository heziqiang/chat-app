import { Types } from 'mongoose';
import { Message, Channel, User, ReadStatus } from '../../models';
import type { IMessage } from '../../models';
import type { GqlContext } from '../index';

export const messageResolvers = {
  Query: {
    messages: async (
      _: unknown,
      args: { channelId: string; limit?: number; before?: string },
    ) => {
      const { channelId, limit = 30, before } = args;
      const filter: Record<string, unknown> = {
        channelId: new Types.ObjectId(channelId),
      };
      if (before) {
        filter._id = { $lt: new Types.ObjectId(before) };
      }
      const messages = await Message.find(filter)
        .sort({ _id: -1 })
        .limit(limit);
      // Return in chronological order (oldest first) for display
      return messages.reverse();
    },
  },

  Mutation: {
    sendMessage: async (
      _: unknown,
      args: {
        input: {
          channelId: string;
          content: string;
          replyTo?: string;
          mentions?: string[];
        };
      },
      context: GqlContext,
    ) => {
      const { channelId, content, replyTo, mentions } = args.input;
      if (!context.userId) {
        throw new Error('x-user-id header is required');
      }
      if (!content.trim()) {
        throw new Error('Message content cannot be empty');
      }
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      const message = await Message.create({
        channelId: new Types.ObjectId(channelId),
        senderId: new Types.ObjectId(context.userId),
        content,
        replyToId: replyTo ? new Types.ObjectId(replyTo) : null,
        mentionUserIds: mentions?.map((id) => new Types.ObjectId(id)) ?? [],
      });
      return message;
    },

    markAsRead: async (
      _: unknown,
      args: { channelId: string; messageId: string },
      context: GqlContext,
    ) => {
      if (!context.userId) {
        throw new Error('x-user-id header is required');
      }
      await ReadStatus.findOneAndUpdate(
        {
          userId: new Types.ObjectId(context.userId),
          channelId: new Types.ObjectId(args.channelId),
        },
        { lastReadMessageId: new Types.ObjectId(args.messageId) },
        { upsert: true },
      );
      return true;
    },
  },

  Message: {
    id: (parent: IMessage) => parent._id.toString(),

    sender: async (parent: IMessage) => {
      return User.findById(parent.senderId);
    },

    channel: async (parent: IMessage) => {
      return Channel.findById(parent.channelId);
    },

    replyTo: async (parent: IMessage) => {
      if (!parent.replyToId) return null;
      return Message.findById(parent.replyToId);
    },

    mentions: async (parent: IMessage) => {
      if (!parent.mentionUserIds?.length) return [];
      return User.find({ _id: { $in: parent.mentionUserIds } });
    },

    createdAt: (parent: IMessage) => parent.createdAt.toISOString(),
  },
};
