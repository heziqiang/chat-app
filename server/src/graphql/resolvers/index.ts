import { channelResolvers } from './channel';
import { messageResolvers } from './message';
import { userResolvers } from './user';

// Merge resolvers from all domain modules
const resolvers = {
  Query: {
    ...channelResolvers.Query,
    ...messageResolvers.Query,
    ...userResolvers.Query,
  },
  Mutation: {
    ...messageResolvers.Mutation,
  },
  Channel: {
    ...channelResolvers.Channel,
  },
  Message: {
    ...messageResolvers.Message,
  },
  User: {
    ...userResolvers.User,
  },
};

export default resolvers;
