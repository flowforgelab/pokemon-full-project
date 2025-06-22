import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

const tradeStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED']);

export const tradeRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        offeredCards: z.array(
          z.object({
            cardId: z.string(),
            quantity: z.number().min(1),
          })
        ),
        requestedCards: z.array(
          z.object({
            cardId: z.string(),
            quantity: z.number().min(1),
          })
        ),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot trade with yourself',
        });
      }

      return ctx.prisma.tradeOffer.create({
        data: {
          offererId: ctx.userId,
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
        status: tradeStatusEnum,
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

      const isOfferer = trade.offererId === ctx.userId;
      const isReceiver = trade.receiverId === ctx.userId;

      if (!isOfferer && !isReceiver) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not part of this trade',
        });
      }

      if (trade.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This trade has already been resolved',
        });
      }

      if (input.status === 'CANCELLED' && !isOfferer) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only the offerer can cancel a trade',
        });
      }

      if ((input.status === 'ACCEPTED' || input.status === 'REJECTED') && !isReceiver) {
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
        status: tradeStatusEnum.optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { type, status, page, pageSize } = input;
      const skip = (page - 1) * pageSize;

      const where: any = {
        ...(status && { status }),
      };

      if (type === 'sent') {
        where.offererId = ctx.userId;
      } else if (type === 'received') {
        where.receiverId = ctx.userId;
      } else {
        where.OR = [{ offererId: ctx.userId }, { receiverId: ctx.userId }];
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

      if (trade.offererId !== ctx.userId && trade.receiverId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not part of this trade',
        });
      }

      return trade;
    }),
});