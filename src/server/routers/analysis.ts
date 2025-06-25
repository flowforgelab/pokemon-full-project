import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, premiumProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import { getAnalysisCache } from '@/server/db/redis';
import { pokemonTCGQueue } from '@/lib/jobs/queue-wrapper';

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
        const cacheKey = `analysis:${deckId}:${mode}`;
        const cached = await getAnalysisCache().get(cacheKey);
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
                  attacks: true,
                  abilities: true,
                  weaknesses: true,
                  resistances: true,
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
      if (!deck.isPublic && deck.user.id !== ctx.user?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to analyze this deck',
        });
      }
      
      // Create analyzer instance
      const analyzer = new DeckAnalyzer();
      
      // Transform deck data for analyzer
      const analysisData = {
        id: deck.id,
        name: deck.name,
        format: deck.format?.name || 'Standard',
        cards: deck.cards.map(dc => ({
          ...dc.card,
          quantity: dc.quantity,
        })),
      };
      
      // Perform analysis based on mode
      let analysis;
      switch (mode) {
        case 'quick':
          analysis = await analyzer.quickAnalysis(analysisData);
          break;
        case 'comprehensive':
          analysis = await analyzer.comprehensiveAnalysis(analysisData);
          break;
        default:
          analysis = await analyzer.analyze(analysisData);
      }
      
      // Add recommendations if requested
      if (options.includeRecommendations) {
        const recommendations = await analyzer.getRecommendations(analysisData, analysis);
        analysis.recommendations = recommendations;
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
      
      // Update deck with latest analysis
      await ctx.prisma.deck.update({
        where: { id: deckId },
        data: {
          lastAnalysis: analysis,
          consistencyScore: analysis.consistency.overallScore,
          speedScore: analysis.speed.score,
          synergyScore: analysis.synergy.score,
        },
      });
      
      // Cache results
      if (options.cacheResults !== false) {
        const cacheKey = `analysis:${deckId}:${mode}`;
        const ttl = mode === 'quick' ? 300 : 3600; // 5 min for quick, 1 hour for others
        await getAnalysisCache().set(cacheKey, result, ttl);
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
                    attacks: true,
                    abilities: true,
                    weaknesses: true,
                    resistances: true,
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
                    attacks: true,
                    abilities: true,
                    weaknesses: true,
                    resistances: true,
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
      const canAccessDeck1 = deck1.isPublic || deck1.userId === ctx.user?.id;
      const canAccessDeck2 = deck2.isPublic || deck2.userId === ctx.user?.id;
      
      if (!canAccessDeck1 || !canAccessDeck2) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to compare these decks',
        });
      }
      
      // Create analyzer
      const analyzer = new DeckAnalyzer();
      
      // Transform deck data
      const deckData1 = {
        id: deck1.id,
        name: deck1.name,
        format: deck1.format?.name || 'Standard',
        cards: deck1.cards.map(dc => ({
          ...dc.card,
          quantity: dc.quantity,
        })),
      };
      
      const deckData2 = {
        id: deck2.id,
        name: deck2.name,
        format: deck2.format?.name || 'Standard',
        cards: deck2.cards.map(dc => ({
          ...dc.card,
          quantity: dc.quantity,
        })),
      };
      
      // Perform comparison
      const comparison = await analyzer.compare(deckData1, deckData2);
      
      // Add matchup prediction if requested
      if (includeMatchup) {
        const matchup = await analyzer.predictMatchup(deckData1, deckData2);
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
      
      // Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        select: { userId: true },
      });
      
      if (!deck || deck.userId !== ctx.user?.id) {
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
      
      // Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
        select: { userId: true },
      });
      
      if (!deck || deck.userId !== ctx.user?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to schedule analysis for this deck',
        });
      }
      
      // Queue analysis job
      const job = await pokemonTCGQueue.add('analyzeDeck', {
        deckId,
        userId: ctx.user.id,
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
                  attacks: true,
                  abilities: true,
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
      
      // Check permissions
      if (!deck.isPublic && deck.userId !== ctx.user?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view recommendations for this deck',
        });
      }
      
      // Get recent analysis or perform new one
      let analysis = deck.lastAnalysis;
      if (!analysis || new Date(deck.updatedAt) > new Date(analysis.analyzedAt)) {
        const analyzer = new DeckAnalyzer();
        const deckData = {
          id: deck.id,
          name: deck.name,
          format: deck.format?.name || 'Standard',
          cards: deck.cards.map(dc => ({
            ...dc.card,
            quantity: dc.quantity,
          })),
        };
        analysis = await analyzer.analyze(deckData);
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
      
      // Check permissions
      if (!deck.isPublic && deck.userId !== ctx.user?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to export this analysis',
        });
      }
      
      // Get or generate analysis
      const analyzer = new DeckAnalyzer();
      const deckData = {
        id: deck.id,
        name: deck.name,
        format: deck.format?.name || 'Standard',
        cards: deck.cards.map(dc => ({
          ...dc.card,
          quantity: dc.quantity,
        })),
      };
      
      const analysis = await analyzer.comprehensiveAnalysis(deckData);
      
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