import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { TradeStatus } from '@prisma/client';

export const tradeRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        offeredCards: z.array(
          z.object({
            cardId: z.string(),
            quantity: z.number().min(1),
            condition: z.string().optional(),
          })
        ),
        requestedCards: z.array(
          z.object({
            cardId: z.string(),
            quantity: z.number().min(1),
            condition: z.string().optional(),
          })
        ),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (input.receiverId === user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot trade with yourself',
        });
      }

      return ctx.prisma.tradeOffer.create({
        data: {
          offererId: user.id,
          receiverId: input.receiverId,
          offeredCards: input.offeredCards,
          requestedCards: input.requestedCards,
          message: input.message,
        },
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(TradeStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trade = await ctx.prisma.tradeOffer.findUnique({
        where: { id: input.id },
        select: {
          offererId: true,
          receiverId: true,
          status: true,
        },
      });

      if (!trade) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade offer not found',
        });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const isOfferer = trade.offererId === user.id;
      const isReceiver = trade.receiverId === user.id;

      if (!isOfferer && !isReceiver) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not part of this trade',
        });
      }

      if (trade.status !== TradeStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This trade has already been resolved',
        });
      }

      if (input.status === TradeStatus.CANCELLED && !isOfferer) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only the offerer can cancel a trade',
        });
      }

      if ((input.status === TradeStatus.ACCEPTED || input.status === TradeStatus.REJECTED) && !isReceiver) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only the receiver can accept or reject a trade',
        });
      }

      return ctx.prisma.tradeOffer.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  getUserTrades: protectedProcedure
    .input(
      z.object({
        type: z.enum(['sent', 'received', 'all']).default('all'),
        status: z.nativeEnum(TradeStatus).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { type, status, page, pageSize } = input;
      const skip = (page - 1) * pageSize;

      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const where: Record<string, any> = {
        ...(status && { status }),
      };

      if (type === 'sent') {
        where.offererId = user.id;
      } else if (type === 'received') {
        where.receiverId = user.id;
      } else {
        where.OR = [{ offererId: user.id }, { receiverId: user.id }];
      }

      const [trades, total] = await ctx.prisma.$transaction([
        ctx.prisma.tradeOffer.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            offerer: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            receiver: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        }),
        ctx.prisma.tradeOffer.count({ where }),
      ]);

      return {
        trades,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const trade = await ctx.prisma.tradeOffer.findUnique({
        where: { id: input },
        include: {
          offerer: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!trade) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade offer not found',
        });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (trade.offererId !== user.id && trade.receiverId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not part of this trade',
        });
      }

      return trade;
    }),
});