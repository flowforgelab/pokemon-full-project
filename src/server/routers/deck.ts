import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure, premiumProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { DeckType, DeckCategory, Supertype } from '@prisma/client';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { DeckValidator } from '@/lib/deck-builder/deck-validator';
import { redis as kv } from '@/server/db/redis';
import crypto from 'crypto';
import { 
  requireResourcePermission,
  requireOwnership,
  requirePublicOrOwned,
  requireSubscriptionFeature,
  checkDeckLimit,
  auditLog,
  rateLimitBySubscription
} from '@/server/api/middleware/permissions';

// Validation schemas
const cardInputSchema = z.object({
  cardId: z.string(),
  quantity: z.number().min(1).max(4),
  category: z.nativeEnum(DeckCategory).default(DeckCategory.MAIN),
  position: z.number().optional(),
});

const deckFilterSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(50).default(10),
  formatId: z.string().optional(),
  deckType: z.nativeEnum(DeckType).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created', 'updated', 'name', 'wins', 'winRate']).default('updated'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const deckRouter = createTRPCRouter({
  create: protectedProcedure
    .use(checkDeckLimit)
    .use(requireResourcePermission('deck', 'create'))
    .use(rateLimitBySubscription('deck:create'))
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
    .use(requireResourcePermission('deck', 'update'))
    .use(auditLog('update', 'deck'))
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
    .use(requireResourcePermission('deck', 'delete'))
    .use(auditLog('delete', 'deck'))
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

  // Duplicate a deck
  duplicate: protectedProcedure
    .use(checkDeckLimit)
    .use(requireResourcePermission('deck', 'create'))
    .use(rateLimitBySubscription('deck:duplicate'))
    .input(z.object({
      deckId: z.string(),
      name: z.string().min(1).max(100).optional(),
    }))
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

      // Get original deck
      const originalDeck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId },
        include: {
          cards: true,
        },
      });

      if (!originalDeck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found',
        });
      }

      // Check permissions
      if (!originalDeck.isPublic && originalDeck.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to duplicate this deck',
        });
      }

      // Create duplicate
      const duplicatedDeck = await ctx.prisma.deck.create({
        data: {
          name: input.name || `${originalDeck.name} (Copy)`,
          description: originalDeck.description,
          formatId: originalDeck.formatId,
          deckType: originalDeck.deckType,
          isPublic: false,
          tags: originalDeck.tags,
          coverCardId: originalDeck.coverCardId,
          userId: user.id,
          cards: {
            create: originalDeck.cards.map((card, index) => ({
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

      return duplicatedDeck;
    }),

  // Validate deck for format legality
  validate: publicProcedure
    .input(z.object({
      deckId: z.string(),
      formatId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId },
        include: {
          cards: {
            include: {
              card: true,
            },
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

      // Check if deck is public or owned by user
      if (!deck.isPublic) {
        const user = await ctx.prisma.user.findUnique({
          where: { clerkUserId: ctx.userId || '' },
          select: { id: true },
        });
        
        if (!user || deck.userId !== user.id) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to validate this deck',
          });
        }
      }

      const validator = new DeckValidator();
      const validation = await validator.validate({
        cards: deck.cards.map(dc => ({
          ...dc.card,
          quantity: dc.quantity,
        })),
        format: input.formatId ? 
          await ctx.prisma.format.findUnique({ where: { id: input.formatId } }) : 
          deck.format,
      });

      return validation;
    }),

  // Share deck with unique URL
  share: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      expiresIn: z.enum(['1hour', '1day', '1week', '1month', 'never']).default('1week'),
    }))
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
        where: { id: input.deckId },
        select: { userId: true },
      });

      if (!deck || deck.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to share this deck',
        });
      }

      // Generate unique share token
      const shareToken = crypto.randomBytes(16).toString('hex');
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/deck/shared/${shareToken}`;

      // Calculate expiration
      const expirations = {
        '1hour': 60 * 60,
        '1day': 24 * 60 * 60,
        '1week': 7 * 24 * 60 * 60,
        '1month': 30 * 24 * 60 * 60,
        'never': null,
      };

      const ttl = expirations[input.expiresIn];

      // Store share data in cache
      await kv.set(
        `deck:share:${shareToken}`,
        { deckId: input.deckId, userId: user.id },
        ttl ? { ex: ttl } : undefined
      );

      return {
        shareUrl,
        shareToken,
        expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : null,
      };
    }),

  // Get deck from share token
  getShared: publicProcedure
    .input(z.object({
      shareToken: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Get share data from cache
      const shareData = await kv.get(`deck:share:${input.shareToken}`) as any;

      if (!shareData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Share link expired or invalid',
        });
      }

      const deck = await ctx.prisma.deck.findUnique({
        where: { id: shareData.deckId },
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

      return deck;
    }),

  // Test deck hands
  testHands: publicProcedure
    .input(z.object({
      deckId: z.string(),
      hands: z.number().min(1).max(100).default(7),
      handSize: z.number().min(1).max(10).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId },
        include: {
          cards: {
            include: {
              card: true,
            },
            where: {
              category: DeckCategory.MAIN,
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

      // Check permissions
      if (!deck.isPublic) {
        const user = await ctx.prisma.user.findUnique({
          where: { clerkUserId: ctx.userId || '' },
          select: { id: true },
        });
        
        if (!user || deck.userId !== user.id) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to test this deck',
          });
        }
      }

      // Use deckBuilderManager instead of creating new instance
      const testResults = await builder.testHands({
        cards: deck.cards.map(dc => ({
          ...dc.card,
          quantity: dc.quantity,
        })),
        hands: input.hands,
        handSize: input.handSize,
      });

      return testResults;
    }),

  // Update deck statistics
  updateStats: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      result: z.enum(['win', 'loss', 'draw']),
      opponentDeckId: z.string().optional(),
      notes: z.string().optional(),
    }))
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
        where: { id: input.deckId },
        select: { userId: true },
      });

      if (!deck || deck.userId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to update this deck',
        });
      }

      // Update deck stats
      const updateData: any = {
        lastPlayedAt: new Date(),
      };

      if (input.result === 'win') updateData.wins = { increment: 1 };
      else if (input.result === 'loss') updateData.losses = { increment: 1 };
      else if (input.result === 'draw') updateData.draws = { increment: 1 };

      const updatedDeck = await ctx.prisma.deck.update({
        where: { id: input.deckId },
        data: updateData,
      });

      // Update matchup data if opponent deck provided
      if (input.opponentDeckId) {
        await ctx.prisma.matchup.upsert({
          where: {
            deckId_opponentDeckId: {
              deckId: input.deckId,
              opponentDeckId: input.opponentDeckId,
            },
          },
          create: {
            deckId: input.deckId,
            opponentDeckId: input.opponentDeckId,
            wins: input.result === 'win' ? 1 : 0,
            losses: input.result === 'loss' ? 1 : 0,
            draws: input.result === 'draw' ? 1 : 0,
            notes: input.notes,
          },
          update: {
            wins: input.result === 'win' ? { increment: 1 } : undefined,
            losses: input.result === 'loss' ? { increment: 1 } : undefined,
            draws: input.result === 'draw' ? { increment: 1 } : undefined,
            notes: input.notes,
          },
        });
      }

      return updatedDeck;
    }),

  // Get deck matchups
  getMatchups: publicProcedure
    .input(z.object({
      deckId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const matchups = await ctx.prisma.matchup.findMany({
        where: { deckId: input.deckId },
        include: {
          opponentDeck: {
            select: {
              id: true,
              name: true,
              coverCardId: true,
            },
          },
        },
        orderBy: [
          { wins: 'desc' },
          { losses: 'asc' },
        ],
      });

      return matchups.map(matchup => ({
        ...matchup,
        winRate: matchup.wins + matchup.losses > 0
          ? (matchup.wins / (matchup.wins + matchup.losses)) * 100
          : 0,
        totalGames: matchup.wins + matchup.losses + matchup.draws,
      }));
    }),

  // Export deck in various formats
  export: publicProcedure
    .input(z.object({
      deckId: z.string(),
      format: z.enum(['ptcgo', 'ptcgl', 'text', 'json', 'csv']),
    }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId },
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
        },
      });

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found',
        });
      }

      // Check permissions
      if (!deck.isPublic) {
        const user = await ctx.prisma.user.findUnique({
          where: { clerkUserId: ctx.userId || '' },
          select: { id: true },
        });
        
        if (!user || deck.userId !== user.id) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You do not have permission to export this deck',
          });
        }
      }

      // Use deckBuilderManager instead of creating new instance
      const exported = await builder.export({
        deck,
        format: input.format,
      });

      return exported;
    }),

  // Import deck from text
  import: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      content: z.string(),
      format: z.enum(['ptcgo', 'ptcgl', 'text']),
      formatId: z.string().optional(),
    }))
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

      // Use deckBuilderManager instead of creating new instance
      const parsedDeck = await builder.import({
        content: input.content,
        format: input.format,
      });

      // Create deck with parsed cards
      const deck = await ctx.prisma.deck.create({
        data: {
          name: input.name,
          description: `Imported from ${input.format.toUpperCase()}`,
          formatId: input.formatId,
          userId: user.id,
          cards: {
            create: parsedDeck.cards.map((card, index) => ({
              cardId: card.id,
              quantity: card.quantity,
              category: DeckCategory.MAIN,
              position: index,
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

      return deck;
    }),

  // Get deck suggestions (premium)
  getSuggestions: premiumProcedure
    .input(z.object({
      deckId: z.string(),
      type: z.enum(['similar', 'counter', 'upgrade']),
      limit: z.number().min(1).max(10).default(5),
    }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId },
        include: {
          cards: {
            include: {
              card: true,
            },
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

      // Check permissions
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!deck.isPublic && deck.userId !== user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view this deck',
        });
      }

      // Use deckBuilderManager instead of creating new instance
      const suggestions = await builder.getSuggestions({
        deck,
        type: input.type,
        limit: input.limit,
        userId: user?.id,
      });

      return suggestions;
    }),
});