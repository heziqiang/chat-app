import { User } from '../../models';
import type { IUser } from '../../models';

export const userResolvers = {
  Query: {
    users: async (_: unknown, args: { search?: string }) => {
      const filter: Record<string, unknown> = {};
      if (args.search) {
        const regex = { $regex: args.search, $options: 'i' };
        filter.$or = [{ username: regex }, { displayName: regex }];
      }
      return User.find(filter).sort({ username: 1 });
    },
  },

  User: {
    id: (parent: IUser) => parent._id.toString(),
  },
};
