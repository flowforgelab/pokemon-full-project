import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { DeckType, DeckCategory } from '@prisma/client';

export const deckRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        formatId: z.string().optional(),
        deckType: z.nativeEnum(DeckType).default(DeckType.CONSTRUCTED),
        isPublic: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        coverCardId: z.string().optional(),
        cards: z.array(
          z.object({
            cardId: z.string(),
            quantity: z.number().min(1).max(4),
            category: z.nativeEnum(DeckCategory).default(DeckCategory.MAIN),
            position: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cards, ...deckData } = input;

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

      return ctx.prisma.deck.create({
        data: {
          ...deckData,
          userId: user.id,
          cards: {
            create: cards.map((card, index) => ({
              cardId: card.cardId,
              quantity: card.quantity,
              category: card.category,
              position: card.position ?? index,
            })),
          },
        },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  set: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
          format: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        formatId: z.string().optional(),
        deckType: z.nativeEnum(DeckType).optional(),
        isPublic: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        coverCardId: z.string().optional(),
        cards: z
          .array(
            z.object({
              cardId: z.string(),
              quantity: z.number().min(1).max(4),
              category: z.nativeEnum(DeckCategory).default(DeckCategory.MAIN),
              position: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, cards, ...updateData } = input;

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

      const deck = await ctx.prisma.deck.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!deck || deck.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to edit this deck',
        });
      }

      if (cards) {
        await ctx.prisma.deckCard.deleteMany({
          where: { deckId: id },
        });
      }

      return ctx.prisma.deck.update({
        where: { id },
        data: {
          ...updateData,
          cards: cards
            ? {
                create: cards.map((card, index) => ({
                  cardId: card.cardId,
                  quantity: card.quantity,
                  category: card.category,
                  position: card.position ?? index,
                })),
              }
            : undefined,
        },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  set: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
          format: true,
        },
      });
    }),

  delete: protectedProcedure
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

      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input },
        select: { userId: true },
      });

      if (!deck || deck.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete this deck',
        });
      }

      return ctx.prisma.deck.delete({
        where: { id: input },
      });
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          cards: {
            include: {
              card: {
                include: {
                  set: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
          format: true,
        },
      });

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found',
        });
      }

      if (!deck.isPublic) {
        const user = await ctx.prisma.user.findUnique({
          where: { clerkUserId: ctx.userId || '' },
          select: { id: true },
        });
        
        if (!user || deck.userId !== user.id) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to view this deck',
          });
        }
      }

      return deck;
    }),

  getUserDecks: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(10),
        formatId: z.string().optional(),
        deckType: z.nativeEnum(DeckType).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, formatId, deckType } = input;
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
        ...(formatId && { formatId }),
        ...(deckType && { deckType }),
      };

      const [decks, total] = await ctx.prisma.$transaction([
        ctx.prisma.deck.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { updatedAt: 'desc' },
          include: {
            format: true,
            _count: {
              select: { cards: true },
            },
          },
        }),
        ctx.prisma.deck.count({ where }),
      ]);

      return {
        decks,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  getPublicDecks: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(10),
        formatId: z.string().optional(),
        deckType: z.nativeEnum(DeckType).optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, formatId, deckType, tags, search } = input;
      const skip = (page - 1) * pageSize;

      const where: Record<string, any> = {
        isPublic: true,
        ...(formatId && { formatId }),
        ...(deckType && { deckType }),
        ...(tags?.length && { tags: { hasSome: tags } }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      };

      const [decks, total] = await ctx.prisma.$transaction([
        ctx.prisma.deck.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { updatedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            format: true,
            _count: {
              select: { cards: true },
            },
          },
        }),
        ctx.prisma.deck.count({ where }),
      ]);

      return {
        decks,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),
});