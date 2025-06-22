import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

const cardConditionEnum = z.enum([
  'MINT',
  'NEAR_MINT',
  'LIGHTLY_PLAYED',
  'MODERATELY_PLAYED',
  'HEAVILY_PLAYED',
  'DAMAGED',
]);

export const collectionRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.collection.create({
        data: {
          ...input,
          userId: ctx.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const collection = await ctx.prisma.collection.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!collection || collection.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to edit this collection',
        });
      }

      return ctx.prisma.collection.update({
        where: { id },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const collection = await ctx.prisma.collection.findUnique({
        where: { id: input },
        select: { userId: true },
      });

      if (!collection || collection.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete this collection',
        });
      }

      return ctx.prisma.collection.delete({
        where: { id: input },
      });
    }),

  addCard: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        cardId: z.string(),
        quantity: z.number().min(1),
        condition: cardConditionEnum.default('NEAR_MINT'),
        isForTrade: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const collection = await ctx.prisma.collection.findUnique({
        where: { id: input.collectionId },
        select: { userId: true },
      });

      if (!collection || collection.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to add cards to this collection',
        });
      }

      const existingCard = await ctx.prisma.collectionCard.findUnique({
        where: {
          collectionId_cardId_condition: {
            collectionId: input.collectionId,
            cardId: input.cardId,
            condition: input.condition,
          },
        },
      });

      if (existingCard) {
        return ctx.prisma.collectionCard.update({
          where: { id: existingCard.id },
          data: {
            quantity: existingCard.quantity + input.quantity,
            isForTrade: input.isForTrade,
          },
        });
      }

      return ctx.prisma.collectionCard.create({
        data: input,
      });
    }),

  updateCard: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        quantity: z.number().min(0).optional(),
        condition: cardConditionEnum.optional(),
        isForTrade: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const collectionCard = await ctx.prisma.collectionCard.findUnique({
        where: { id },
        include: {
          collection: {
            select: { userId: true },
          },
        },
      });

      if (!collectionCard || collectionCard.collection.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to update this card',
        });
      }

      if (updateData.quantity === 0) {
        return ctx.prisma.collectionCard.delete({
          where: { id },
        });
      }

      return ctx.prisma.collectionCard.update({
        where: { id },
        data: updateData,
      });
    }),

  getUserCollections: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.collection.findMany({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });
  }),

  getCollectionCards: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        isForTrade: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { collectionId, page, pageSize, search, isForTrade } = input;
      const skip = (page - 1) * pageSize;

      const collection = await ctx.prisma.collection.findUnique({
        where: { id: collectionId },
        select: { userId: true },
      });

      if (!collection || collection.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view this collection',
        });
      }

      const where: Record<string, any> = {
        collectionId,
        ...(isForTrade !== undefined && { isForTrade }),
        ...(search && {
          card: {
            name: { contains: search, mode: 'insensitive' },
          },
        }),
      };

      const [cards, total] = await ctx.prisma.$transaction([
        ctx.prisma.collectionCard.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { card: { name: 'asc' } },
          include: {
            card: true,
          },
        }),
        ctx.prisma.collectionCard.count({ where }),
      ]);

      return {
        cards,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),
});