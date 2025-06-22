import { createTRPCRouter } from '@/server/trpc';
import { userRouter } from './user';
import { cardRouter } from './card';
import { deckRouter } from './deck';
import { collectionRouter } from './collection';
import { tradeRouter } from './trade';

export const appRouter = createTRPCRouter({
  user: userRouter,
  card: cardRouter,
  deck: deckRouter,
  collection: collectionRouter,
  trade: tradeRouter,
});

export type AppRouter = typeof appRouter;