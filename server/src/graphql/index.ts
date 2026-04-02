export { default as typeDefs } from './schema';
export { default as resolvers } from './resolvers';

export interface GqlContext {
  userId: string | null;
}
