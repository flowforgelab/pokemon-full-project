import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

export const userRouter = createTRPCRouter({
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { clerkUserId: ctx.userId },
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
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        bio: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.upsert({
        where: { clerkUserId: ctx.userId },
        create: {
          clerkUserId: ctx.userId,
          email: input.email,
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
        },
        update: {
          email: input.email,
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
        },
      });
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20).optional(),
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        bio: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { clerkUserId: ctx.userId },
        data: input,
      });
    }),
});