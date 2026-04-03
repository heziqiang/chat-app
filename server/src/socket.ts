import mongoose from 'mongoose';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { Channel } from './models';

type JoinableSocket = Pick<Socket, 'handshake' | 'join'>;

export async function joinAuthorizedChannel(
  socket: JoinableSocket,
  channelId: string,
) {
  const userId = socket.handshake.auth.userId;
  if (
    typeof userId !== 'string' ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(channelId)
  ) {
    return false;
  }

  const membership = await Channel.exists({
    _id: new mongoose.Types.ObjectId(channelId),
    memberUserIds: new mongoose.Types.ObjectId(userId),
  });
  if (!membership) {
    return false;
  }

  socket.join(channelId);
  return true;
}

export function registerSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket) => {
    socket.on('join_channel', ({ channelId }: { channelId: string }) => {
      void joinAuthorizedChannel(socket, channelId);
    });

    socket.on('leave_channel', ({ channelId }: { channelId: string }) => {
      socket.leave(channelId);
    });
  });
}
