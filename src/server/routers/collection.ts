import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { CardCondition } from '@prisma/client';

export const collectionRouter = createTRPCRouter({
  // Get user's collection summary
  getSummary: protectedProcedure.query(async ({ ctx }) => {
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

    const [totalCards, uniqueCards, totalValue] = await ctx.prisma.$transaction([
      ctx.prisma.userCollection.aggregate({
        where: { userId: user.id, isWishlist: false },
        _sum: { quantity: true, quantityFoil: true },
      }),
      ctx.prisma.userCollection.count({
        where: { userId: user.id, isWishlist: false },
      }),
      ctx.prisma.userCollection.aggregate({
        where: { userId: user.id, isWishlist: false },
        _sum: { purchasePrice: true },
      }),
    ]);

    return {
      totalCards: (totalCards._sum.quantity || 0) + (totalCards._sum.quantityFoil || 0),
      uniqueCards,
      totalValue: totalValue._sum.purchasePrice || 0,
    };
  }),

  // Add a card to the collection
  addCard: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        quantity: z.number().min(1).default(1),
        quantityFoil: z.number().min(0).default(0),
        condition: z.nativeEnum(CardCondition).default(CardCondition.NEAR_MINT),
        language: z.string().default('EN'),
        purchasePrice: z.number().optional(),
        acquiredDate: z.date().optional(),
        notes: z.string().optional(),
        isWishlist: z.boolean().default(false),
        isForTrade: z.boolean().default(false),
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

      // Check if this exact card already exists in the collection
      const existingCard = await ctx.prisma.userCollection.findUnique({
        where: {
          userId_cardId_condition_language_isWishlist: {
            userId: user.id,
            cardId: input.cardId,
            condition: input.condition,
            language: input.language,
            isWishlist: input.isWishlist,
          },
        },
      });

      if (existingCard) {
        // Update quantities
        return ctx.prisma.userCollection.update({
          where: { id: existingCard.id },
          data: {
            quantity: existingCard.quantity + input.quantity,
            quantityFoil: existingCard.quantityFoil + input.quantityFoil,
            isForTrade: input.isForTrade,
            notes: input.notes || existingCard.notes,
            purchasePrice: input.purchasePrice || existingCard.purchasePrice,
          },
        });
      }

      return ctx.prisma.userCollection.create({
        data: {
          ...input,
          userId: user.id,
        },
      });
    }),

  // Update a card in the collection
  updateCard: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        quantity: z.number().min(0).optional(),
        quantityFoil: z.number().min(0).optional(),
        condition: z.nativeEnum(CardCondition).optional(),
        language: z.string().optional(),
        purchasePrice: z.number().optional(),
        acquiredDate: z.date().optional(),
        notes: z.string().optional(),
        isForTrade: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

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

      const userCollection = await ctx.prisma.userCollection.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!userCollection || userCollection.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to update this card',
        });
      }

      // If both quantities are 0, delete the card
      if (updateData.quantity === 0 && updateData.quantityFoil === 0) {
        return ctx.prisma.userCollection.delete({
          where: { id },
        });
      }

      return ctx.prisma.userCollection.update({
        where: { id },
        data: updateData,
      });
    }),

  // Delete a card from the collection
  deleteCard: protectedProcedure
    .input(z.string())
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

      const userCollection = await ctx.prisma.userCollection.findUnique({
        where: { id: input },
        select: { userId: true },
      });

      if (!userCollection || userCollection.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete this card',
        });
      }

      return ctx.prisma.userCollection.delete({
        where: { id: input },
      });
    }),

  // Get user's collection cards
  getCards: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        isWishlist: z.boolean().optional(),
        isForTrade: z.boolean().optional(),
        condition: z.nativeEnum(CardCondition).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, isWishlist, isForTrade, condition } = input;
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
        userId: user.id,
        ...(isWishlist !== undefined && { isWishlist }),
        ...(isForTrade !== undefined && { isForTrade }),
        ...(condition && { condition }),
        ...(search && {
          card: {
            name: { contains: search, mode: 'insensitive' },
          },
        }),
      };

      const [cards, total] = await ctx.prisma.$transaction([
        ctx.prisma.userCollection.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { card: { name: 'asc' } },
          include: {
            card: {
              include: {
                set: true,
              },
            },
          },
        }),
        ctx.prisma.userCollection.count({ where }),
      ]);

      return {
        cards,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // Get user's wishlist
  getWishlist: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
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

      const where = {
        userId: user.id,
        isWishlist: true,
      };

      const [cards, total] = await ctx.prisma.$transaction([
        ctx.prisma.userCollection.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            card: {
              include: {
                set: true,
                prices: {
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        }),
        ctx.prisma.userCollection.count({ where }),
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