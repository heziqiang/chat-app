import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { User, Channel, Message, ReadStatus } from './models';
import { typeDefs, resolvers, type GqlContext } from './graphql';

const PORT = process.env.PORT || 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/gradual-chat';

async function start() {
  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Ensure all model indexes exist on fresh DB
  await Promise.all([
    User.syncIndexes(),
    Channel.syncIndexes(),
    Message.syncIndexes(),
    ReadStatus.syncIndexes(),
  ]);
  console.log('Database indexes synced');

  // Apollo Server
  const apollo = new ApolloServer<GqlContext>({ typeDefs, resolvers });
  await apollo.start();

  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) => ({
        userId: (req.headers['x-user-id'] as string) || null,
      }),
    }),
  );

  // Socket.io will be wired in Slice 6

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
