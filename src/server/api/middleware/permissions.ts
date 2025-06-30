import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../trpc';
import { checkPermission, getDbUser } from '@/lib/auth/clerk';
import { prisma } from '@/server/db/prisma';

/**
 * Middleware to check resource-level permissions
 */
export const requireResourcePermission = (resource: string, action: string) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const hasPermission = await checkPermission(ctx.userId, resource, action);
    
    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to ${action} ${resource}`,
      });
    }
    
    return next();
  });
};

/**
 * Middleware to check ownership of a resource
 */
export const requireOwnership = <TInput extends { id: string }>(
  getResource: (id: string) => Promise<{ userId: string } | null>
) => {
  return protectedProcedure.use(async ({ ctx, input, next }) => {
    const typedInput = input as TInput;
    const resource = await getResource(typedInput.id);
    
    if (!resource) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Resource not found',
      });
    }
    
    if (resource.userId !== ctx.user.id) {
      // Check if user has admin permissions
      const hasAdminPermission = await checkPermission(ctx.userId, '*', 'manage');
      
      if (!hasAdminPermission) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
        });
      }
    }
    
    return next();
  });
};

/**
 * Middleware to check if a resource is public or owned by the user
 */
export const requirePublicOrOwned = <TInput extends { id: string }>(
  getResource: (id: string) => Promise<{ userId: string; isPublic?: boolean } | null>
) => {
  return protectedProcedure.use(async ({ ctx, input, next }) => {
    const typedInput = input as TInput;
    const resource = await getResource(typedInput.id);
    
    if (!resource) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Resource not found',
      });
    }
    
    // Allow if public
    if (resource.isPublic) {
      return next();
    }
    
    // Allow if owner
    if (resource.userId === ctx.user.id) {
      return next();
    }
    
    // Check if user has admin/moderator permissions
    const hasAdminPermission = await checkPermission(ctx.userId, '*', 'read');
    
    if (!hasAdminPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this resource',
      });
    }
    
    return next();
  });
};

/**
 * Middleware to check subscription features
 */
export const requireSubscriptionFeature = (feature: keyof Awaited<ReturnType<typeof import('@/lib/auth/clerk').getSubscriptionFeatures>>) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const { getSubscriptionFeatures } = await import('@/lib/auth/clerk');
    const features = await getSubscriptionFeatures(ctx.user.subscriptionTier);
    
    if (!features[feature] || (typeof features[feature] === 'number' && features[feature] === 0)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This feature requires a premium subscription`,
      });
    }
    
    return next({
      ctx: {
        ...ctx,
        subscriptionFeatures: features,
      },
    });
  });
};

/**
 * Middleware to check deck limit
 */
export const checkDeckLimit = protectedProcedure.use(async ({ ctx, next }) => {
  const { getSubscriptionFeatures } = await import('@/lib/auth/clerk');
  const features = await getSubscriptionFeatures(ctx.user.subscriptionTier);
  
  if (features.maxDecks !== -1) {
    const deckCount = await prisma.deck.count({
      where: { userId: ctx.user.id },
    });
    
    if (deckCount >= features.maxDecks) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You have reached your deck limit of ${features.maxDecks}. Upgrade your subscription to create more decks.`,
      });
    }
  }
  
  return next();
});

/**
 * Middleware to check collection size limit
 */
export const checkCollectionLimit = protectedProcedure.use(async ({ ctx, next }) => {
  const { getSubscriptionFeatures } = await import('@/lib/auth/clerk');
  const features = await getSubscriptionFeatures(ctx.user.subscriptionTier);
  
  // Add collection size limits based on subscription
  const collectionLimits = {
    FREE: 100,
    BASIC: 500,
    PREMIUM: 2000,
    ULTIMATE: -1, // Unlimited
  };
  
  const limit = collectionLimits[ctx.user.subscriptionTier];
  
  if (limit !== -1) {
    const collectionCount = await prisma.userCollection.count({
      where: { userId: ctx.user.id },
    });
    
    if (collectionCount >= limit) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You have reached your collection limit of ${limit} cards. Upgrade your subscription to add more cards.`,
      });
    }
  }
  
  return next();
});

/**
 * Middleware for bulk operations
 */
export const requireBulkOperationPermission = (maxItems: Record<string, number> = {
  FREE: 10,
  BASIC: 25,
  PREMIUM: 100,
  ULTIMATE: 500,
}) => {
  return protectedProcedure.use(async ({ ctx, input, next }) => {
    const items = (input as any).items || (input as any).cards || [];
    const limit = maxItems[ctx.user.subscriptionTier];
    
    if (items.length > limit) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You can only process ${limit} items at once with your current subscription`,
      });
    }
    
    return next();
  });
};

/**
 * Rate limiting middleware with subscription-based limits
 */
export const rateLimitBySubscription = (
  resource: string,
  limits: Record<string, { requests: number; window: number }> = {
    FREE: { requests: 10, window: 60 }, // 10 requests per minute
    BASIC: { requests: 30, window: 60 }, // 30 requests per minute
    PREMIUM: { requests: 100, window: 60 }, // 100 requests per minute
    ULTIMATE: { requests: 1000, window: 60 }, // 1000 requests per minute
  }
) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  return protectedProcedure.use(async ({ ctx, next }) => {
    const key = `${ctx.userId}:${resource}`;
    const now = Date.now();
    const limit = limits[ctx.user.subscriptionTier];
    
    let requestData = requestCounts.get(key);
    
    if (!requestData || now > requestData.resetTime) {
      requestData = {
        count: 0,
        resetTime: now + (limit.window * 1000),
      };
    }
    
    if (requestData.count >= limit.requests) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil((requestData.resetTime - now) / 1000)} seconds`,
      });
    }
    
    requestData.count++;
    requestCounts.set(key, requestData);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of requestCounts.entries()) {
        if (now > v.resetTime) {
          requestCounts.delete(k);
        }
      }
    }
    
    return next();
  });
};

/**
 * Audit logging middleware for sensitive operations
 */
export const auditLog = (action: string, resourceType: string) => {
  return protectedProcedure.use(async ({ ctx, input, next }) => {
    const result = await next();
    
    // Log the action
    try {
      await prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action,
          resourceType,
          resourceId: (input as any).id || (result as any).id || null,
          metadata: {
            input: JSON.stringify(input),
            timestamp: new Date().toISOString(),
          },
          ipAddress: ctx.headers?.['x-forwarded-for'] as string || 'unknown',
          userAgent: ctx.headers?.['user-agent'] as string || 'unknown',
        },
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      console.error('Audit logging failed:', error);
    }
    
    return result;
  });
};

/**
 * Feature flag middleware
 */
export const requireFeatureFlag = (flag: string) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const featureFlag = await prisma.featureFlag.findUnique({
      where: { key: flag },
    });
    
    if (!featureFlag || !featureFlag.enabled) {
      // Check if user has override
      const userHasOverride = ctx.user.features?.includes(flag);
      
      if (!userHasOverride) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This feature is not currently available',
        });
      }
    }
    
    return next();
  });
};