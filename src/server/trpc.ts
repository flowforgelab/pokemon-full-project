import { initTRPC, TRPCError } from '@trpc/server';
import { prisma } from '@/server/db/prisma';
import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import SuperJSON from 'superjson';
import { ZodError } from 'zod';
import { getDbUser, getUserRole } from '@/lib/auth/clerk';
import { RateLimiter } from '@/lib/api/rate-limiter';
import type { User } from '@prisma/client';

interface CreateContextOptions {
  userId: string | null;
  user: User | null;
  userRole: string | null;
  req: NextRequest | null;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    userId: opts.userId,
    user: opts.user,
    userRole: opts.userRole,
    prisma,
    req: opts.req,
  };
};

export const createTRPCContext = async (opts: {
  req: NextRequest;
  resHeaders: Headers;
}) => {
  const session = await auth();
  let user: User | null = null;
  let userRole: string | null = null;
  
  if (session?.userId) {
    user = await getDbUser(session.userId);
    const role = user ? await getUserRole(user.clerkUserId) : null;
    userRole = role ? role.name : null;
  }
  
  return createInnerTRPCContext({
    userId: session?.userId || null,
    user,
    userRole,
    req: opts.req,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: SuperJSON,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

/**
 * Middleware for logging all requests
 */
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  
  console.log(`[${type}] ${path} - ${duration}ms`);
  
  return result;
});

/**
 * Middleware for rate limiting
 */
const rateLimitMiddleware = t.middleware(async ({ ctx, meta, next }) => {
  if (ctx.req && ctx.userId) {
    // Default rate limit can be overridden by meta
    const maxRequests = (meta as any)?.rateLimit?.requests || 100;
    
    const rateLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests,
    });
    
    const allowed = await rateLimiter.checkLimit(ctx.userId);
    if (!allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }
  }
  
  return next();
});

/**
 * Public procedure - accessible to all
 */
export const publicProcedure = t.procedure
  .use(loggerMiddleware)
  .use(rateLimitMiddleware);

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure
  .use(loggerMiddleware)
  .use(rateLimitMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.userId || !ctx.user) {
      throw new TRPCError({ 
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action' 
      });
    }
    return next({
      ctx: {
        userId: ctx.userId,
        user: ctx.user,
        userRole: ctx.userRole,
      },
    });
  });

/**
 * Admin procedure - requires admin role
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'super_admin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Admin access required' 
    });
  }
  return next();
});

/**
 * Premium procedure - requires premium subscription
 */
export const premiumProcedure = protectedProcedure.use(({ ctx, next }) => {
  const premiumRoles = ['premium_user', 'pro_user', 'admin', 'super_admin'];
  if (!ctx.userRole || !premiumRoles.includes(ctx.userRole)) {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Premium subscription required for this feature' 
    });
  }
  return next();
});