import './loadEnv';
import express, { type Express } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { Server as SocketIOServer } from 'socket.io';
import { User, Channel, Message, ReadStatus } from './models';
import { typeDefs, resolvers, type GqlContext } from './graphql';
import { registerSocketHandlers } from './socket';

const PORT = process.env.PORT || 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime-chat';

export async function createApp(): Promise<{
  app: Express;
  apollo: ApolloServer<GqlContext>;
  ioRef: { current: SocketIOServer | null };
}> {
  const app = express();
  const ioRef: { current: SocketIOServer | null } = { current: null };

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Apollo Server
  const apollo = new ApolloServer<GqlContext>({ typeDefs, resolvers });
  await apollo.start();

  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) => ({
        userId: (req.headers['x-user-id'] as string) || null,
        io: ioRef.current,
        socketId: (req.headers['x-socket-id'] as string) || null,
      }),
    }),
  );

  // Serve client static files in production (Docker build copies to ../public)
  const publicPath = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  return { app, apollo, ioRef };
}

export async function connectToDatabase(uri = MONGODB_URI) {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
}

export async function syncModelIndexes() {
  await Promise.all([
    User.syncIndexes(),
    Channel.syncIndexes(),
    Message.syncIndexes(),
    ReadStatus.syncIndexes(),
  ]);
  console.log('Database indexes synced');
}

export async function start() {
  const { app, ioRef } = await createApp();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });
  ioRef.current = io;

  registerSocketHandlers(io);

  await connectToDatabase(MONGODB_URI);
  await syncModelIndexes();

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
