import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, premiumProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import { SafeAnalyzer } from '@/lib/analysis/safe-analyzer';
import { getAnalysisCache, redis } from '@/server/db/redis';
import { pokemonTCGQueue } from '@/lib/jobs/queue-wrapper';
import { 
  requireResourcePermission,
  requireSubscriptionFeature,
  rateLimitBySubscription
} from '@/server/api/middleware/permissions';

// Validation schemas
const analysisModeSchema = z.enum(['quick', 'standard', 'comprehensive']).default('standard');

const compareDeckSchema = z.object({
  deckId1: z.string(),
  deckId2: z.string(),
  includeMatchup: z.boolean().default(true),
});

const analysisOptionsSchema = z.object({
  mode: analysisModeSchema,
  includeRecommendations: z.boolean().default(true),
  includePricing: z.boolean().default(false),
  includeHistory: z.boolean().default(false),
  cacheResults: z.boolean().default(true),
});

export const analysisRouter = createTRPCRouter({
  /**
   * Analyze a single deck
   */
  analyzeDeck: publicProcedure
    .input(z.object({
      deckId: z.string(),
      options: analysisOptionsSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { deckId, options = {} } = input;
      const mode = options.mode || 'standard';
      
      // Check cache first
      if (options.cacheResults !== false) {
        const cacheKey = `${deckId}:${mode}`;
        const cached = await getAnalysisCache(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      // Get deck with all card data
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  set: true,
                  ...(options.includePricing ? {
                    prices: {
                      orderBy: { updatedAt: 'desc' },
                      take: 1,
                    },
                  } : {}),
                },
              },
            },
          },
          format: true,
          user: {
            select: {
              id: true,
              username: true,
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
      
      // Check if deck is public or belongs to user
      if (!deck.isPublic) {
        // Get the current user if authenticated
        let currentUserId = null;
        if (ctx.userId) {
          const currentUser = await ctx.prisma.user.findUnique({
            where: { clerkUserId: ctx.userId },
            select: { id: true },
          });
          currentUserId = currentUser?.id;
        }
        
        if (deck.user.id !== currentUserId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to analyze this deck',
          });
        }
      }
      
      // Create analyzer instance - use SafeAnalyzer for production stability
      const analyzer = new SafeAnalyzer();
      
      // Perform analysis with guaranteed valid results
      let analysis;
      try {
        analysis = await analyzer.analyzeDeck(deck);
      } catch (error) {
        console.error('Analysis failed, using SafeAnalyzer fallback:', error);
        // SafeAnalyzer should never throw, but just in case...
        const safeAnalyzer = new SafeAnalyzer();
        analysis = await safeAnalyzer.analyzeDeck(deck);
      }
      
      // Add recommendations if requested (premium feature)
      if (options.includeRecommendations) {
        // Check if user has premium access for advanced recommendations
        if (ctx.userId) {
          const user = await ctx.prisma.user.findUnique({
            where: { clerkUserId: ctx.userId },
            select: { subscriptionTier: true },
          });
          
          if (user?.subscriptionTier === 'FREE') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Advanced recommendations require a premium subscription',
            });
          }
        } else {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Please sign in to access recommendations',
          });
        }
        // Recommendations are already included in the analysis result
        // from the analyzeDeck method
      }
      
      // Add pricing data if requested
      if (options.includePricing) {
        const totalValue = deck.cards.reduce((sum, dc) => {
          const price = dc.card.prices?.[0]?.marketPrice || 0;
          return sum + (price * dc.quantity);
        }, 0);
        
        analysis.pricing = {
          totalValue,
          averageCardValue: totalValue / deck.cards.length,
          mostExpensive: deck.cards
            .map(dc => ({
              card: dc.card,
              value: (dc.card.prices?.[0]?.marketPrice || 0) * dc.quantity,
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        };
      }
      
      // Add analysis history if requested
      if (options.includeHistory && ctx.userId) {
        // In a real implementation, would track analysis history
        analysis.history = {
          previousAnalyses: 0,
          lastAnalyzed: new Date(),
          trends: [],
        };
      }
      
      // Save analysis results
      const result = {
        deckId,
        deckName: deck.name,
        format: deck.format?.name || 'Standard',
        analysis,
        analyzedAt: new Date(),
      };
      
      // Note: The deck doesn't have lastAnalysis fields in the schema
      // This would need to be stored separately if we want to persist analysis results
      
      // Cache results
      if (options.cacheResults !== false) {
        const cacheKey = `analysis:${deckId}:${mode}`;
        const ttl = mode === 'quick' ? 300 : 3600; // 5 min for quick, 1 hour for others
        await redis.setex(cacheKey, ttl, JSON.stringify(result));
      }
      
      return result;
    }),
  
  /**
   * Compare two decks
   */
  compareDecks: publicProcedure
    .input(compareDeckSchema)
    .query(async ({ ctx, input }) => {
      const { deckId1, deckId2, includeMatchup } = input;
      
      // Get both decks
      const [deck1, deck2] = await ctx.prisma.$transaction([
        ctx.prisma.deck.findUnique({
          where: { id: deckId1 },
          include: {
            cards: {
              include: {
                card: {
                  include: {
                    set: true,
                  },
                },
              },
            },
            format: true,
          },
        }),
        ctx.prisma.deck.findUnique({
          where: { id: deckId2 },
          include: {
            cards: {
              include: {
                card: {
                  include: {
                    set: true,
                  },
                },
              },
            },
            format: true,
          },
        }),
      ]);
      
      if (!deck1 || !deck2) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or both decks not found',
        });
      }
      
      // Check permissions
      let currentUserId = null;
      if (ctx.userId) {
        const currentUser = await ctx.prisma.user.findUnique({
          where: { clerkUserId: ctx.userId },
          select: { id: true },
        });
        currentUserId = currentUser?.id;
      }
      
      const canAccessDeck1 = deck1.isPublic || deck1.userId === currentUserId;
      const canAccessDeck2 = deck2.isPublic || deck2.userId === currentUserId;
      
      if (!canAccessDeck1 || !canAccessDeck2) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to compare these decks',
        });
      }
      
      // Create analyzer - use SafeAnalyzer for stability
      const analyzer = new SafeAnalyzer();
      
      // Analyze both decks separately with error handling
      let analysis1, analysis2;
      try {
        analysis1 = await analyzer.analyzeDeck(deck1);
      } catch (error) {
        console.error('Analysis 1 failed:', error);
        analysis1 = await new SafeAnalyzer().analyzeDeck(deck1);
      }
      
      try {
        analysis2 = await analyzer.analyzeDeck(deck2);
      } catch (error) {
        console.error('Analysis 2 failed:', error);
        analysis2 = await new SafeAnalyzer().analyzeDeck(deck2);
      }
      
      // Create comparison based on individual analyses
      const comparison = {
        deck1Analysis: analysis1,
        deck2Analysis: analysis2,
        // Compare key metrics
        consistencyDifference: analysis1.consistency.overallConsistency - analysis2.consistency.overallConsistency,
        speedDifference: analysis1.scores.speed - analysis2.scores.speed,
        synergyDifference: analysis1.synergy.overallSynergy - analysis2.synergy.overallSynergy,
        // Determine which deck is favored
        favoredDeck: analysis1.scores.overall > analysis2.scores.overall ? 'deck1' : 'deck2',
        favoredBy: Math.abs(analysis1.scores.overall - analysis2.scores.overall),
      };
      
      // Add matchup prediction if requested
      if (includeMatchup) {
        // Basic matchup prediction based on archetype and scores
        const matchup = {
          deck1Archetype: analysis1.archetype.primaryArchetype,
          deck2Archetype: analysis2.archetype.primaryArchetype,
          deck1WinRate: Math.max(20, Math.min(80, 50 + (analysis1.scores.overall - analysis2.scores.overall) / 2)),
          deck2WinRate: Math.max(20, Math.min(80, 50 + (analysis2.scores.overall - analysis1.scores.overall) / 2)),
          keyFactors: [
            analysis1.scores.speed > analysis2.scores.speed ? 'Deck 1 has speed advantage' : 'Deck 2 has speed advantage',
            analysis1.consistency.overallConsistency > analysis2.consistency.overallConsistency ? 'Deck 1 is more consistent' : 'Deck 2 is more consistent',
          ],
        };
        comparison.matchup = matchup;
      }
      
      return {
        deck1: {
          id: deck1.id,
          name: deck1.name,
          format: deck1.format?.name,
        },
        deck2: {
          id: deck2.id,
          name: deck2.name,
          format: deck2.format?.name,
        },
        comparison,
        comparedAt: new Date(),
      };
    }),
  
  /**
   * Get deck statistics over time
   */
  getDeckStats: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      timeframe: z.enum(['day', 'week', 'month', 'all']).default('week'),
    }))
    .query(async ({ ctx, input }) => {
      const { deckId, timeframe } = input;
      
      // Get current user
      const currentUser = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      // Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        select: { userId: true },
      });
      
      if (!deck || deck.userId !== currentUser.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view stats for this deck',
        });
      }
      
      // Calculate date threshold
      const dateThreshold = new Date();
      switch (timeframe) {
        case 'day':
          dateThreshold.setDate(dateThreshold.getDate() - 1);
          break;
        case 'week':
          dateThreshold.setDate(dateThreshold.getDate() - 7);
          break;
        case 'month':
          dateThreshold.setMonth(dateThreshold.getMonth() - 1);
          break;
      }
      
      // Get matchup statistics
      const matchups = await ctx.prisma.matchup.findMany({
        where: {
          OR: [
            { deckId, createdAt: { gte: dateThreshold } },
            { opponentDeckId: deckId, createdAt: { gte: dateThreshold } },
          ],
        },
        include: {
          deck: {
            select: { name: true },
          },
          opponentDeck: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      // Calculate win rate
      const wins = matchups.filter(m => 
        (m.deckId === deckId && m.result === 'WIN') ||
        (m.opponentDeckId === deckId && m.result === 'LOSS')
      ).length;
      
      const losses = matchups.filter(m => 
        (m.deckId === deckId && m.result === 'LOSS') ||
        (m.opponentDeckId === deckId && m.result === 'WIN')
      ).length;
      
      const draws = matchups.filter(m => m.result === 'DRAW').length;
      const totalGames = wins + losses + draws;
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
      
      // Get performance by archetype
      const archetypeStats = await ctx.prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN m."deckId" = ${deckId} THEN od."archetype"
            ELSE d."archetype"
          END as opponent_archetype,
          COUNT(*) as games,
          SUM(CASE 
            WHEN (m."deckId" = ${deckId} AND m.result = 'WIN') OR 
                 (m."opponentDeckId" = ${deckId} AND m.result = 'LOSS') 
            THEN 1 ELSE 0 
          END) as wins
        FROM "Matchup" m
        LEFT JOIN "Deck" d ON d.id = m."deckId"
        LEFT JOIN "Deck" od ON od.id = m."opponentDeckId"
        WHERE (m."deckId" = ${deckId} OR m."opponentDeckId" = ${deckId})
          AND m."createdAt" >= ${dateThreshold}
        GROUP BY opponent_archetype
        ORDER BY games DESC
      `;
      
      return {
        summary: {
          totalGames,
          wins,
          losses,
          draws,
          winRate,
        },
        matchups: matchups.slice(0, 20), // Last 20 games
        archetypePerformance: archetypeStats,
        timeframe,
      };
    }),
  
  /**
   * Schedule comprehensive analysis (premium)
   */
  scheduleAnalysis: premiumProcedure
    .input(z.object({
      deckId: z.string(),
      frequency: z.enum(['daily', 'weekly', 'on_change']).default('on_change'),
      options: analysisOptionsSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deckId, frequency, options } = input;
      
      // Get current user
      const currentUser = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      // Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        select: { userId: true },
      });
      
      if (!deck || deck.userId !== currentUser.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to schedule analysis for this deck',
        });
      }
      
      // Queue analysis job
      const job = await pokemonTCGQueue.add('analyzeDeck', {
        deckId,
        userId: currentUser.id,
        options: {
          ...options,
          mode: 'comprehensive',
        },
      }, {
        repeat: frequency === 'daily' ? {
          pattern: '0 0 * * *', // Daily at midnight
        } : frequency === 'weekly' ? {
          pattern: '0 0 * * 0', // Weekly on Sunday
        } : undefined,
      });
      
      return {
        jobId: job.id,
        message: `Analysis scheduled ${frequency}`,
      };
    }),
  
  /**
   * Get analysis recommendations
   */
  getRecommendations: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      type: z.enum(['cards', 'strategy', 'sideboard', 'all']).default('all'),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { deckId, type, limit } = input;
      
      // Get deck with analysis
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          cards: {
            include: {
              card: {
                include: {
                  set: true,
                },
              },
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
      
      // Get current user
      const currentUser = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      // Check permissions
      if (!deck.isPublic && deck.userId !== currentUser.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view recommendations for this deck',
        });
      }
      
      // Always perform new analysis since we don't store lastAnalysis in the database
      const analyzer = new SafeAnalyzer();
      let analysis;
      try {
        analysis = await analyzer.analyzeDeck(deck);
      } catch (error) {
        console.error('Analysis failed in recommendations:', error);
        analysis = await new SafeAnalyzer().analyzeDeck(deck);
      }
      
      // Generate recommendations based on type
      const recommendations = {
        cards: [],
        strategy: [],
        sideboard: [],
      };
      
      if (type === 'all' || type === 'cards') {
        // Card recommendations based on synergies and missing roles
        const cardRecs = await ctx.prisma.card.findMany({
          where: {
            AND: [
              // Same format legality
              deck.format ? {
                legalities: {
                  [deck.format.name.toLowerCase()]: 'LEGAL',
                },
              } : {},
              // Not already in deck
              {
                id: {
                  notIn: deck.cards.map(dc => dc.cardId),
                },
              },
              // Similar types or synergistic abilities
              {
                OR: [
                  // Same types as main attackers
                  {
                    types: {
                      hasSome: deck.cards
                        .filter(dc => dc.card.supertype === 'POKEMON')
                        .flatMap(dc => dc.card.types),
                    },
                  },
                  // Trainer cards that work with deck strategy
                  {
                    supertype: 'TRAINER',
                    // Would need more complex logic here
                  },
                ],
              },
            ],
          },
          take: limit,
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        });
        
        recommendations.cards = cardRecs.map(card => ({
          card,
          reason: 'Synergizes with your deck strategy',
          impact: 'medium',
        }));
      }
      
      if (type === 'all' || type === 'strategy') {
        // Strategy recommendations based on analysis
        if (analysis.consistency.overallScore < 70) {
          recommendations.strategy.push({
            title: 'Improve Consistency',
            description: 'Your deck has consistency issues. Consider adding more draw supporters and search cards.',
            priority: 'high',
          });
        }
        
        if (analysis.speed.score < 60) {
          recommendations.strategy.push({
            title: 'Increase Speed',
            description: 'Your deck sets up slowly. Add more energy acceleration and basic Pokemon.',
            priority: 'medium',
          });
        }
      }
      
      if (type === 'all' || type === 'sideboard') {
        // Sideboard recommendations based on meta
        recommendations.sideboard = [
          {
            title: 'Tech Against Fire Decks',
            cards: ['Water-type attacker suggestions'],
            reason: 'Fire decks are popular in the current meta',
          },
        ];
      }
      
      return {
        deckId,
        recommendations,
        basedOn: {
          analysisDate: analysis.analyzedAt || new Date(),
          deckVersion: deck.updatedAt,
        },
      };
    }),
  
  /**
   * Export analysis report
   */
  exportAnalysis: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      format: z.enum(['pdf', 'json', 'markdown']).default('pdf'),
      includeVisuals: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deckId, format, includeVisuals } = input;
      
      // Get deck with full analysis
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          cards: {
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
          },
          format: true,
          user: {
            select: {
              username: true,
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
      
      // Get current user
      const currentUser = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      // Check permissions
      if (!deck.isPublic && deck.userId !== currentUser.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to export this analysis',
        });
      }
      
      // Get or generate analysis
      const analyzer = new SafeAnalyzer();
      let analysis;
      try {
        analysis = await analyzer.analyzeDeck(deck);
      } catch (error) {
        console.error('Analysis failed in export:', error);
        analysis = await new SafeAnalyzer().analyzeDeck(deck);
      }
      
      // Generate export based on format
      let exportData;
      let mimeType;
      let filename;
      
      switch (format) {
        case 'json':
          exportData = JSON.stringify({
            deck: {
              id: deck.id,
              name: deck.name,
              format: deck.format?.name,
              owner: deck.user.username,
            },
            analysis,
            exportedAt: new Date(),
          }, null, 2);
          mimeType = 'application/json';
          filename = `${deck.name.replace(/\s+/g, '_')}_analysis.json`;
          break;
          
        case 'markdown':
          exportData = `# ${deck.name} - Deck Analysis\n\n` +
            `**Format:** ${deck.format?.name || 'Standard'}\n` +
            `**Owner:** ${deck.user.username}\n` +
            `**Analyzed:** ${new Date().toLocaleDateString()}\n\n` +
            `## Overall Scores\n` +
            `- Consistency: ${analysis.consistency.overallScore}/100\n` +
            `- Speed: ${analysis.speed.score}/100\n` +
            `- Synergy: ${analysis.synergy.score}/100\n\n` +
            `## Detailed Analysis\n` +
            `${JSON.stringify(analysis, null, 2)}`;
          mimeType = 'text/markdown';
          filename = `${deck.name.replace(/\s+/g, '_')}_analysis.md`;
          break;
          
        case 'pdf':
          // In a real implementation, would generate PDF
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'PDF export not yet implemented',
          });
          
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid export format',
          });
      }
      
      return {
        data: exportData,
        mimeType,
        filename,
      };
    }),
});