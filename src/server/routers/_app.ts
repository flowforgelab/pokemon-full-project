import { createTRPCRouter } from '@/server/trpc';
import { userRouter } from './user';
import { cardRouter } from './card';
import { deckRouter } from './deck';
import { collectionRouter } from './collection';
import { tradeRouter } from './trade';
import { analysisRouter } from './analysis';
import { pricingRouter } from './pricing';
import { recommendationRouter } from './recommendation';
import { adminRouter } from './admin';
import { subscriptionRouter } from './subscription';
import { notificationRouter } from './notification';
import { socialRouter } from './social';

/**
 * Main application router combining all sub-routers
 */
export const appRouter = createTRPCRouter({
  // Core functionality
  user: userRouter,
  card: cardRouter,
  deck: deckRouter,
  collection: collectionRouter,
  
  // Trading & marketplace
  trade: tradeRouter,
  pricing: pricingRouter,
  
  // Advanced features
  analysis: analysisRouter,
  recommendation: recommendationRouter,
  
  // User management
  subscription: subscriptionRouter,
  notification: notificationRouter,
  social: socialRouter,
  
  // Administration
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;