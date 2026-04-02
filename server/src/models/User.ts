import mongoose, { Schema, Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  displayName: string;
  avatarUrl: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', userSchema);
