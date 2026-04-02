import mongoose, { Schema, Types } from 'mongoose';

export interface IMessage {
  _id: Types.ObjectId;
  channelId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  replyToId?: Types.ObjectId | null;
  mentionUserIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    replyToId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    mentionUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

// Compound index: channel message listing with cursor pagination
messageSchema.index({ channelId: 1, _id: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
