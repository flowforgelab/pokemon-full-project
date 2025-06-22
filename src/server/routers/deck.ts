import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

const deckFormatEnum = z.enum(['STANDARD', 'EXPANDED', 'UNLIMITED', 'GLC']);

export const deckRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        format: deckFormatEnum,
        isPublic: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        cards: z.array(
          z.object({
            cardId: z.string(),
            quantity: z.number().min(1).max(4),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cards, ...deckData } = input;

      return ctx.prisma.deck.create({
        data: {
          ...deckData,
          userId: ctx.userId,
          cards: {
            create: cards.map((card) => ({
              cardId: card.cardId,
              quantity: card.quantity,
            })),
          },
        },
        include: {
          cards: {
            include: {
              card: true,
            },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        format: deckFormatEnum.optional(),
        isPublic: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        cards: z
          .array(
            z.object({
              cardId: z.string(),
              quantity: z.number().min(1).max(4),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, cards, ...updateData } = input;

      const deck = await ctx.prisma.deck.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!deck || deck.userId !== ctx.userId) {
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
                create: cards.map((card) => ({
                  cardId: card.cardId,
                  quantity: card.quantity,
                })),
              }
            : undefined,
        },
        include: {
          cards: {
            include: {
              card: true,
            },
          },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input },
        select: { userId: true },
      });

      if (!deck || deck.userId !== ctx.userId) {
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
              card: true,
            },
          },
        },
      });

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found',
        });
      }

      if (!deck.isPublic && deck.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view this deck',
        });
      }

      return deck;
    }),

  getUserDecks: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(10),
        format: deckFormatEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, format } = input;
      const skip = (page - 1) * pageSize;

      const where = {
        userId: ctx.userId,
        ...(format && { format }),
      };

      const [decks, total] = await ctx.prisma.$transaction([
        ctx.prisma.deck.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { updatedAt: 'desc' },
          include: {
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
        format: deckFormatEnum.optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, format, tags, search } = input;
      const skip = (page - 1) * pageSize;

      const where: Record<string, any> = {
        isPublic: true,
        ...(format && { format }),
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