import { type HydratedDocument, Types } from 'mongoose';
import { Message, Channel, User, ReadStatus } from '../../models';
import type { IMessage, IUser } from '../../models';
import type { GqlContext } from '../index';
import { requireChannelAccess, requireUserId } from './channel';

type MessageDocument = HydratedDocument<IMessage>;
type UserDocument = HydratedDocument<IUser>;

export const messageResolvers = {
  Query: {
    messages: async (
      _: unknown,
      args: { channelId: string; limit?: number; before?: string },
      context: GqlContext,
    ) => {
      await requireChannelAccess(args.channelId, context);

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
      const userId = requireUserId(context);
      if (!content.trim()) {
        throw new Error('Message content cannot be empty');
      }
      const { channel } = await requireChannelAccess(channelId, context);
      let replyMessage: MessageDocument | null = null;
      let replySender: UserDocument | null = null;

      if (replyTo) {
        if (!Types.ObjectId.isValid(replyTo)) {
          throw new Error('Quoted message is invalid');
        }

        replyMessage = await Message.findOne({
          _id: new Types.ObjectId(replyTo),
          channelId: new Types.ObjectId(channelId),
        });
        if (!replyMessage) {
          throw new Error('Quoted message not found');
        }

        replySender = await User.findById(replyMessage.senderId);
      }

      const mentionIds = mentions ?? [];
      const mentionObjectIds = mentionIds.map((id) => new Types.ObjectId(id));
      const channelMemberIds = new Set(channel.memberUserIds.map((id) => id.toString()));

      if (mentionObjectIds.some((id) => !channelMemberIds.has(id.toString()))) {
        throw new Error('Mentioned users must belong to the channel');
      }

      const mentionedUsers = mentionObjectIds.length
        ? await User.find({ _id: { $in: mentionObjectIds } })
        : [];
      const mentionedUsersById = new Map(
        mentionedUsers.map((user) => [user._id.toString(), user] as const),
      );
      const mentionPayload = mentionObjectIds.map((id) => {
        const mentionedUser = mentionedUsersById.get(id.toString());
        if (!mentionedUser) {
          throw new Error('Mentioned users must belong to the channel');
        }

        return {
          id: mentionedUser._id.toString(),
          username: mentionedUser.username,
          displayName: mentionedUser.displayName,
        };
      });

      const message = await Message.create({
        channelId: new Types.ObjectId(channelId),
        senderId: new Types.ObjectId(userId),
        content,
        replyToId: replyMessage?._id ?? null,
        mentionUserIds: mentionObjectIds,
      });

      // Broadcast to other users in the channel
      if (context.io) {
        const sender = await User.findById(message.senderId);
        const replyToData = replyMessage
          ? {
              id: replyMessage._id.toString(),
              content: replyMessage.content,
              sender: replySender
                ? { id: replySender._id.toString(), displayName: replySender.displayName }
                : null,
            }
          : null;

        const payload = {
          id: message._id.toString(),
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          sender: sender
            ? {
                id: sender._id.toString(),
                username: sender.username,
                displayName: sender.displayName,
                avatarUrl: sender.avatarUrl,
              }
            : null,
          mentions: mentionPayload,
          replyTo: replyToData,
        };

        const room = context.io.to(channelId);
        const target = context.socketId ? room.except(context.socketId) : room;
        target.emit('new_message', { channelId, message: payload });
      }

      return message;
    },

    markAsRead: async (
      _: unknown,
      args: { channelId: string; messageId: string },
      context: GqlContext,
    ) => {
      const userId = requireUserId(context);
      await requireChannelAccess(args.channelId, context);

      await ReadStatus.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
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
