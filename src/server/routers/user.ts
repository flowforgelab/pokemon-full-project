import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

export const userRouter = createTRPCRouter({
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { clerkId: ctx.userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),

  createOrUpdateUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        username: z.string().optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.upsert({
        where: { clerkId: ctx.userId },
        create: {
          clerkId: ctx.userId,
          email: input.email,
          username: input.username,
          avatarUrl: input.avatarUrl,
        },
        update: {
          email: input.email,
          username: input.username,
          avatarUrl: input.avatarUrl,
        },
      });
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { clerkId: ctx.userId },
        data: input,
      });
    }),
});