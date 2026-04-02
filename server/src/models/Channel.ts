import mongoose, { Schema, Types } from 'mongoose';

export interface IChannel {
  _id: Types.ObjectId;
  name: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    name: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Channel = mongoose.model<IChannel>('Channel', channelSchema);
