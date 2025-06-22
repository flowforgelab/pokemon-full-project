import { initTRPC, TRPCError } from '@trpc/server';
import { prisma } from '@/server/db/prisma';
import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import SuperJSON from 'superjson';
import { ZodError } from 'zod';

interface CreateContextOptions {
  userId: string | null;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    userId: opts.userId,
    prisma,
  };
};

export const createTRPCContext = async (_opts: {
  req: NextRequest;
  resHeaders: Headers;
}) => {
  const session = await auth();
  
  return createInnerTRPCContext({
    userId: session?.userId || null,
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

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});