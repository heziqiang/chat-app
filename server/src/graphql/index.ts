export { default as typeDefs } from './schema';
export { default as resolvers } from './resolvers';

import type { Server as SocketIOServer } from 'socket.io';

export interface GqlContext {
  userId: string | null;
  io: SocketIOServer | null;
  socketId: string | null;
}
