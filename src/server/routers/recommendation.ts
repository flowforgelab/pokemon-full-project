import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, premiumProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { RecommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import { redis as kv } from '@/server/db/redis';
import { Supertype, Rarity } from '@prisma/client';

// Input schemas
const recommendationPreferencesSchema = z.object({
  playstyle: z.enum(['aggressive', 'control', 'combo', 'midrange']).optional(),
  budget: z.enum(['budget', 'mid', 'competitive', 'unlimited']).optional(),
  favoriteTypes: z.array(z.string()).max(3).optional(),
  excludedCards: z.array(z.string()).optional(),
  formatId: z.string().optional(),
});

const cardRecommendationSchema = z.object({
  cardId: z.string(),
  reason: z.enum([
    'synergy',
    'replacement',
    'upgrade',
    'budget_alternative',
    'meta_choice',
    'collection_completion'
  ]).optional(),
  limit: z.number().min(1).max(20).default(10),
  preferences: recommendationPreferencesSchema.optional(),
});

const deckRecommendationSchema = z.object({
  deckId: z.string().optional(),
  formatId: z.string().optional(),
  budget: z.number().optional(),
  preferences: recommendationPreferencesSchema.optional(),
  includeVariants: z.boolean().default(false),
});

const improvementSuggestionSchema = z.object({
  deckId: z.string(),
  focus: z.enum(['consistency', 'power', 'speed', 'versatility']).optional(),
  maxChanges: z.number().min(1).max(15).default(5),
  preserveCore: z.boolean().default(true),
});

const collectionRecommendationSchema = z.object({
  goal: z.enum([
    'complete_set',
    'trade_value',
    'deck_building',
    'investment',
    'casual_play'
  ]),
  budget: z.number().optional(),
  timeframe: z.enum(['immediate', 'month', 'quarter', 'year']).default('month'),
  preferences: recommendationPreferencesSchema.optional(),
});

export const recommendationRouter = createTRPCRouter({
  // Get card recommendations based on a specific card
  getCardRecommendations: publicProcedure
    .input(cardRecommendationSchema)
    .query(async ({ ctx, input }) => {
      const cacheKey = `recommendations:card:${input.cardId}:${JSON.stringify(input)}`;
      
      // Check cache
      const cached = await kv.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        // Get the source card
        const sourceCard = await ctx.prisma.card.findUnique({
          where: { id: input.cardId },
          include: {
            set: true,
            prices: {
              take: 1,
              orderBy: { updatedAt: 'desc' }
            }
          }
        });

        if (!sourceCard) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Card not found'
          });
        }

        const engine = new RecommendationEngine();
        const recommendations = await engine.recommendCardsForCard({
          card: sourceCard,
          reason: input.reason,
          limit: input.limit,
          preferences: input.preferences,
          userId: ctx.userId
        });

        // Cache for 2 hours
        await kv.set(cacheKey, recommendations, { ex: 7200 });

        return recommendations;
      } catch (error) {
        console.error('Failed to get card recommendations:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate recommendations'
        });
      }
    }),

  // Get deck recommendations based on preferences
  getDeckRecommendations: publicProcedure
    .input(deckRecommendationSchema)
    .query(async ({ ctx, input }) => {
      const cacheKey = `recommendations:deck:${JSON.stringify(input)}`;
      
      // Check cache
      const cached = await kv.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const engine = new RecommendationEngine();
        
        // If deckId provided, base recommendations on that deck
        let baseDeck = null;
        if (input.deckId) {
          baseDeck = await ctx.prisma.deck.findUnique({
            where: { id: input.deckId },
            include: {
              cards: {
                include: { card: true }
              },
              format: true
            }
          });
        }

        const recommendations = await engine.recommendDecks({
          baseDeck,
          formatId: input.formatId,
          budget: input.budget,
          preferences: input.preferences,
          includeVariants: input.includeVariants,
          userId: ctx.userId
        });

        // Cache for 1 hour
        await kv.set(cacheKey, recommendations, { ex: 3600 });

        return recommendations;
      } catch (error) {
        console.error('Failed to get deck recommendations:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate deck recommendations'
        });
      }
    }),

  // Get improvement suggestions for a deck
  getDeckImprovements: protectedProcedure
    .input(improvementSuggestionSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Check if user owns the deck
        const deck = await ctx.prisma.deck.findFirst({
          where: {
            id: input.deckId,
            userId: ctx.userId
          },
          include: {
            cards: {
              include: {
                card: {
                  include: {
                    prices: {
                      take: 1,
                      orderBy: { updatedAt: 'desc' }
                    }
                  }
                }
              }
            },
            format: true
          }
        });

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found or access denied'
          });
        }

        const analyzer = new DeckAnalyzer();
        const analysis = await analyzer.analyze({
          cards: deck.cards.map(dc => ({
            ...dc.card,
            quantity: dc.quantity
          })),
          format: deck.format,
          options: { includeRecommendations: true }
        });

        const engine = new RecommendationEngine();
        const improvements = await engine.suggestImprovements({
          deck,
          analysis,
          focus: input.focus,
          maxChanges: input.maxChanges,
          preserveCore: input.preserveCore
        });

        return improvements;
      } catch (error) {
        console.error('Failed to get deck improvements:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate improvement suggestions'
        });
      }
    }),

  // Get collection recommendations based on goals
  getCollectionRecommendations: protectedProcedure
    .input(collectionRecommendationSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Get user's collection
        const collection = await ctx.prisma.userCollection.findMany({
          where: {
            userId: ctx.userId,
            onWishlist: false
          },
          include: {
            card: {
              include: {
                set: true,
                prices: {
                  take: 1,
                  orderBy: { updatedAt: 'desc' }
                }
              }
            }
          }
        });

        const engine = new RecommendationEngine();
        const recommendations = await engine.recommendForCollection({
          collection,
          goal: input.goal,
          budget: input.budget,
          timeframe: input.timeframe,
          preferences: input.preferences,
          userId: ctx.userId
        });

        return recommendations;
      } catch (error) {
        console.error('Failed to get collection recommendations:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate collection recommendations'
        });
      }
    }),

  // Get trending cards and decks
  getTrending: publicProcedure
    .input(z.object({
      category: z.enum(['cards', 'decks', 'strategies']),
      timeframe: z.enum(['day', 'week', 'month']).default('week'),
      formatId: z.string().optional(),
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `recommendations:trending:${input.category}:${input.timeframe}:${input.formatId || 'all'}`;
      
      // Check cache
      const cached = await kv.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const engine = new RecommendationEngine();
        const trending = await engine.getTrending({
          category: input.category,
          timeframe: input.timeframe,
          formatId: input.formatId,
          limit: input.limit
        });

        // Cache for 1 hour
        await kv.set(cacheKey, trending, { ex: 3600 });

        return trending;
      } catch (error) {
        console.error('Failed to get trending items:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch trending data'
        });
      }
    }),

  // Get personalized recommendations (premium)
  getPersonalized: premiumProcedure
    .input(z.object({
      type: z.enum(['cards', 'decks', 'trades']),
      limit: z.number().min(1).max(50).default(20),
      includeReasons: z.boolean().default(true)
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Get user's play history and preferences
        const [collection, decks, recentActivity] = await Promise.all([
          ctx.prisma.userCollection.findMany({
            where: { userId: ctx.userId },
            include: { card: true }
          }),
          ctx.prisma.deck.findMany({
            where: { userId: ctx.userId },
            include: {
              cards: { include: { card: true } },
              format: true
            },
            orderBy: { lastPlayedAt: 'desc' },
            take: 10
          }),
          ctx.prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { preferences: true }
          })
        ]);

        const engine = new RecommendationEngine();
        const personalized = await engine.getPersonalized({
          type: input.type,
          userId: ctx.userId,
          collection,
          decks,
          preferences: recentActivity?.preferences as any,
          limit: input.limit,
          includeReasons: input.includeReasons
        });

        return personalized;
      } catch (error) {
        console.error('Failed to get personalized recommendations:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate personalized recommendations'
        });
      }
    }),

  // Save recommendation feedback
  saveFeedback: protectedProcedure
    .input(z.object({
      recommendationId: z.string(),
      type: z.enum(['helpful', 'not_helpful', 'already_owned', 'not_interested']),
      comment: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Save feedback for improving recommendations
        const engine = new RecommendationEngine();
        await engine.saveFeedback({
          userId: ctx.userId,
          recommendationId: input.recommendationId,
          type: input.type,
          comment: input.comment
        });

        return { success: true };
      } catch (error) {
        console.error('Failed to save recommendation feedback:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save feedback'
        });
      }
    }),

  // Get recommendation history (premium)
  getHistory: premiumProcedure
    .input(z.object({
      type: z.enum(['all', 'cards', 'decks', 'improvements']).default('all'),
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const engine = new RecommendationEngine();
        const history = await engine.getHistory({
          userId: ctx.userId,
          type: input.type,
          limit: input.limit
        });

        return history;
      } catch (error) {
        console.error('Failed to get recommendation history:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recommendation history'
        });
      }
    }),
});