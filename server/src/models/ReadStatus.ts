import mongoose, { Schema, Types } from 'mongoose';

export interface IReadStatus {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  channelId: Types.ObjectId;
  lastReadMessageId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const readStatusSchema = new Schema<IReadStatus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true },
);

// Unique compound index: one read status per user per channel
readStatusSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export const ReadStatus = mongoose.model<IReadStatus>('ReadStatus', readStatusSchema);
