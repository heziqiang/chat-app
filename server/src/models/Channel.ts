import mongoose, { Schema, Types } from 'mongoose';

export interface IChannel {
  _id: Types.ObjectId;
  name: string;
  type: 'group' | 'dm';
  avatarUrl: string;
  memberUserIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    name: { type: String, default: '' },
    type: { type: String, enum: ['group', 'dm'], default: 'group' },
    avatarUrl: { type: String, default: '' },
    memberUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

export const Channel = mongoose.model<IChannel>('Channel', channelSchema);
