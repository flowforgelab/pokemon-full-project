import { z } from 'zod';
import { 
  createTRPCRouter, 
  protectedProcedure,
  premiumProcedure 
} from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { BudgetOptimizer } from '@/lib/budget/budget-optimizer';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import type { Card, Deck, DeckCard } from '@prisma/client';

const optimizeDeckInput = z.object({
  deckId: z.string(),
  budget: z.number().min(0).max(10000),
  priorityMode: z.enum(['power', 'consistency', 'speed']).default('consistency'),
  excludeOwned: z.boolean().default(false),
  includeProxies: z.boolean().default(false),
  maxChanges: z.number().min(1).max(60).default(20),
});

const budgetAnalysisInput = z.object({
  deckId: z.string(),
  targetBudgets: z.array(z.number()).default([25, 50, 100, 200, 500]),
});

const cardAlternativesInput = z.object({
  cardId: z.string(),
  maxPrice: z.number().min(0).max(1000),
  includeProxies: z.boolean().default(false),
});

export const budgetRouter = createTRPCRouter({
  /**
   * Optimize a deck for a given budget
   */
  optimizeDeck: protectedProcedure
    .input(optimizeDeckInput)
    .query(async ({ ctx, input }) => {
      const { deckId, budget, priorityMode, excludeOwned, maxChanges } = input;

      // Fetch deck with cards and prices
      const deck = await ctx.db.deck.findUnique({
        where: { 
          id: deckId,
          userId: ctx.userId, // Ensure user owns the deck
        },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  prices: {
                    where: {
                      currency: 'USD',
                      isCurrentPrice: true,
                    },
                    orderBy: {
                      updatedAt: 'desc',
                    },
                    take: 1,
                  },
                },
              },
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

      // Calculate current deck value
      const currentValue = deck.cards.reduce((total, dc) => {
        const price = dc.card.prices[0]?.price || 0;
        return total + (Number(price) * dc.quantity);
      }, 0);

      // If deck is already under budget, return as-is
      if (currentValue <= budget) {
        return {
          success: true,
          totalCost: currentValue,
          performanceScore: 100,
          valueScore: 100,
          optimizedDeck: {
            changes: [],
          },
          scores: {
            consistency: 100,
            power: 100,
            speed: 100,
            synergy: 100,
          },
          recommendation: 'Your deck is already within budget! No changes needed.',
        };
      }

      // Get owned cards if needed
      let ownedCards: string[] = [];
      if (!excludeOwned) {
        const collection = await ctx.db.userCollection.findMany({
          where: { userId: ctx.userId },
          select: { cardId: true },
        });
        ownedCards = collection.map(c => c.cardId);
      }

      // Initialize budget optimizer
      const optimizer = new BudgetOptimizer();
      const analyzer = new DeckAnalyzer();

      // Analyze original deck
      const originalAnalysis = await analyzer.analyzeDeck(deck as any);

      // Run optimization
      const optimizationResult = await optimizer.optimizeDeck({
        deck: deck as any,
        budget,
        priorityMode,
        ownedCards,
        maxChanges,
        originalAnalysis,
      });

      // Calculate performance retention
      const newAnalysis = await analyzer.analyzeDeck(optimizationResult.optimizedDeck);
      const performanceScore = Math.round(
        (newAnalysis.scores.overall / originalAnalysis.scores.overall) * 100
      );

      // Calculate value score (performance per dollar)
      const valueScore = Math.round(
        (performanceScore / optimizationResult.totalCost) * 100
      );

      return {
        success: true,
        totalCost: optimizationResult.totalCost,
        performanceScore,
        valueScore,
        optimizedDeck: optimizationResult.optimizedDeck,
        scores: newAnalysis.scores,
        warnings: optimizationResult.warnings,
        tradeoffs: optimizationResult.tradeoffs,
        recommendation: optimizationResult.recommendation,
      };
    }),

  /**
   * Get budget analysis for multiple price points
   */
  analyzeBudgetTiers: protectedProcedure
    .input(budgetAnalysisInput)
    .query(async ({ ctx, input }) => {
      const { deckId, targetBudgets } = input;

      // Fetch deck
      const deck = await ctx.db.deck.findUnique({
        where: { 
          id: deckId,
          userId: ctx.userId,
        },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  prices: {
                    where: {
                      currency: 'USD',
                      isCurrentPrice: true,
                    },
                    take: 1,
                  },
                },
              },
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

      const optimizer = new BudgetOptimizer();
      const analyzer = new DeckAnalyzer();
      const originalAnalysis = await analyzer.analyzeDeck(deck as any);

      // Analyze each budget tier
      const tiers = await Promise.all(
        targetBudgets.map(async (budget) => {
          const result = await optimizer.optimizeDeck({
            deck: deck as any,
            budget,
            priorityMode: 'consistency',
            ownedCards: [],
            maxChanges: 60,
            originalAnalysis,
          });

          const newAnalysis = await analyzer.analyzeDeck(result.optimizedDeck);
          const performanceScore = Math.round(
            (newAnalysis.scores.overall / originalAnalysis.scores.overall) * 100
          );

          return {
            budget,
            totalCost: result.totalCost,
            performanceScore,
            changes: result.optimizedDeck.changes.length,
            scores: newAnalysis.scores,
          };
        })
      );

      return {
        originalValue: deck.cards.reduce((total, dc) => {
          const price = dc.card.prices[0]?.price || 0;
          return total + (Number(price) * dc.quantity);
        }, 0),
        originalScores: originalAnalysis.scores,
        tiers,
      };
    }),

  /**
   * Find budget alternatives for specific cards
   */
  findCardAlternatives: protectedProcedure
    .input(cardAlternativesInput)
    .query(async ({ ctx, input }) => {
      const { cardId, maxPrice } = input;

      // Fetch the card
      const card = await ctx.db.card.findUnique({
        where: { id: cardId },
        include: {
          prices: {
            where: {
              currency: 'USD',
              isCurrentPrice: true,
            },
            take: 1,
          },
          set: true,
        },
      });

      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found',
        });
      }

      const optimizer = new BudgetOptimizer();
      const alternatives = await optimizer.findAlternatives({
        card: card as any,
        maxPrice,
        limit: 10,
      });

      return {
        originalCard: {
          id: card.id,
          name: card.name,
          price: Number(card.prices[0]?.price || 0),
          set: card.set.name,
        },
        alternatives: alternatives.map(alt => ({
          id: alt.card.id,
          name: alt.card.name,
          price: alt.price,
          performanceLoss: alt.performanceLoss,
          reason: alt.reason,
          similarity: alt.similarity,
          recommended: alt.similarity >= 0.8 && alt.performanceLoss <= 20,
        })),
      };
    }),

  /**
   * Get upgrade path recommendations
   */
  getUpgradePath: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      maxBudget: z.number().min(0).max(1000).default(300),
      steps: z.number().min(1).max(10).default(4),
    }))
    .query(async ({ ctx, input }) => {
      const { deckId, maxBudget, steps } = input;

      // Fetch deck
      const deck = await ctx.db.deck.findUnique({
        where: { 
          id: deckId,
          userId: ctx.userId,
        },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  prices: {
                    where: {
                      currency: 'USD',
                      isCurrentPrice: true,
                    },
                    take: 1,
                  },
                },
              },
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

      const optimizer = new BudgetOptimizer();
      const upgradePath = await optimizer.generateUpgradePath({
        deck: deck as any,
        maxBudget,
        steps,
      });

      return upgradePath;
    }),

  /**
   * Apply optimization to deck
   */
  applyOptimization: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      changes: z.array(z.object({
        action: z.enum(['replace', 'remove', 'add', 'adjust']),
        cardId: z.string().optional(),
        oldCardId: z.string().optional(),
        newCardId: z.string().optional(),
        quantity: z.number().optional(),
        oldQuantity: z.number().optional(),
        newQuantity: z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deckId, changes } = input;

      // Verify deck ownership
      const deck = await ctx.db.deck.findUnique({
        where: { 
          id: deckId,
          userId: ctx.userId,
        },
      });

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found',
        });
      }

      // Apply changes in a transaction
      await ctx.db.$transaction(async (tx) => {
        for (const change of changes) {
          if (change.action === 'replace' && change.oldCardId && change.newCardId) {
            // Remove old card
            await tx.deckCard.deleteMany({
              where: {
                deckId,
                cardId: change.oldCardId,
              },
            });

            // Add new card
            await tx.deckCard.create({
              data: {
                deckId,
                cardId: change.newCardId,
                quantity: change.quantity || 1,
                category: 'MAIN',
              },
            });
          } else if (change.action === 'remove' && change.cardId) {
            await tx.deckCard.deleteMany({
              where: {
                deckId,
                cardId: change.cardId,
              },
            });
          } else if (change.action === 'add' && change.cardId) {
            await tx.deckCard.create({
              data: {
                deckId,
                cardId: change.cardId,
                quantity: change.quantity || 1,
                category: 'MAIN',
              },
            });
          } else if (change.action === 'adjust' && change.cardId && change.newQuantity) {
            await tx.deckCard.updateMany({
              where: {
                deckId,
                cardId: change.cardId,
              },
              data: {
                quantity: change.newQuantity,
              },
            });
          }
        }

        // Update deck modification timestamp
        await tx.deck.update({
          where: { id: deckId },
          data: { lastModifiedAt: new Date() },
        });
      });

      return {
        success: true,
        message: `Applied ${changes.length} changes to your deck`,
      };
    }),
});