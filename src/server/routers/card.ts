import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, premiumProcedure } from '@/server/trpc';
import { Rarity, Supertype, DeckCategory } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { getCardCache, redis } from '@/server/db/redis';
import { pokemonTCGQueue } from '@/lib/jobs/queue-wrapper';

// Validation schemas
const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

const sortSchema = z.object({
  field: z.enum(['name', 'number', 'price', 'rarity', 'set', 'releaseDate', 'hp', 'retreatCost']).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

const priceRangeSchema = z.object({
  min: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
});

const cardSearchFiltersSchema = z.object({
  // Card attributes
  types: z.array(z.string()).optional(),
  supertype: z.nativeEnum(Supertype).optional(),
  subtypes: z.array(z.string()).optional(),
  evolvesFrom: z.string().optional(),
  evolvesTo: z.array(z.string()).optional(),
  
  // Set and legality
  setId: z.string().optional(),
  series: z.string().optional(),
  rarity: z.array(z.nativeEnum(Rarity)).optional(),
  isLegalStandard: z.boolean().optional(),
  isLegalExpanded: z.boolean().optional(),
  
  // Stats
  hp: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  retreatCost: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  
  // Price and availability
  priceRange: priceRangeSchema.optional(),
  inStock: z.boolean().optional(),
  ownedOnly: z.boolean().optional(),
  
  // Energy costs
  energyTypes: z.array(z.string()).optional(),
  totalEnergyCost: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  
  // Abilities and attacks
  hasAbility: z.boolean().optional(),
  attackCount: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  
  // Weaknesses and resistances
  weaknessTypes: z.array(z.string()).optional(),
  resistanceTypes: z.array(z.string()).optional(),
});

export const cardRouter = createTRPCRouter({
  /**
   * Optimized card search with relevance ranking
   */
  searchOptimized: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      filters: cardSearchFiltersSchema.optional(),
      pagination: paginationSchema,
      sort: sortSchema,
      includeOwnedStatus: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { query, filters, pagination, sort, includeOwnedStatus } = input;
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;
      
      try {
        // For single character queries, only show prefix matches
        const minSearchLength = query && query.trim().length === 1 ? 1 : 2;
        
        if (!query || query.trim().length < minSearchLength) {
          // If no query or too short, fall back to regular search
          return await ctx.prisma.$transaction(async (tx) => {
            const where: Record<string, any> = {};
            
            // Apply filters
            if (filters?.supertype) {
              where.supertype = filters.supertype;
            }
            
            const [cards, total] = await Promise.all([
              tx.card.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: {
                  set: true,
                  prices: {
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                  },
                },
              }),
              tx.card.count({ where }),
            ]);
            
            return {
              cards,
              total,
              page,
              pageSize: limit,
              totalPages: Math.ceil(total / limit),
            };
          });
        }
        
        // Use raw SQL for relevance-based search
        const searchTerm = query.trim().toLowerCase();
        const isSingleChar = searchTerm.length === 1;
        
        // Build filter conditions
        let filterConditions = '';
        const filterParams: any[] = [];
        
        if (filters?.supertype) {
          filterConditions += ' AND c.supertype = $' + (filterParams.length + 4);
          filterParams.push(filters.supertype);
        }
        
        if (filters?.setId) {
          filterConditions += ' AND c."setId" = $' + (filterParams.length + 4);
          filterParams.push(filters.setId);
        }
        
        if (filters?.series) {
          filterConditions += ' AND s.series = $' + (filterParams.length + 4);
          filterParams.push(filters.series);
        }
        
        // Only search card names, not set names
        const searchCondition = isSingleChar
          ? `c.name ILIKE $2`
          : `c.name ILIKE $3`;
        
        const relevanceQuery = `
          WITH search_results AS (
            SELECT DISTINCT ON (c.id)
              c.*,
              s.name as set_name,
              s.id as set_id,
              CASE
                WHEN LOWER(c.name) = $1 THEN 100
                WHEN LOWER(c.name) LIKE $2 THEN 90
                WHEN LOWER(c.name) ~ ('\\m' || $1) THEN 70
                WHEN LOWER(c.name) LIKE $3 THEN 50
                ELSE 0
              END as relevance_score
            FROM "Card" c
            INNER JOIN "Set" s ON c."setId" = s.id
            WHERE ${searchCondition} ${filterConditions}
          )
          SELECT * FROM search_results
          WHERE relevance_score > 0
          ORDER BY 
            relevance_score DESC,
            name ASC
          LIMIT ${'$' + (filterParams.length + 4)}
          OFFSET ${'$' + (filterParams.length + 5)};
        `;
        
        const countQuery = `
          SELECT COUNT(DISTINCT c.id) as count
          FROM "Card" c
          INNER JOIN "Set" s ON c."setId" = s.id
          WHERE ${searchCondition} ${filterConditions};
        `;
        
        // Execute queries
        const queryParams = [
          searchTerm,                    // $1 - exact match
          searchTerm + '%',              // $2 - prefix match
          '%' + searchTerm + '%',        // $3 - contains match
          ...filterParams,
          limit,
          skip
        ];
        
        const countParams = [
          searchTerm,
          searchTerm + '%',
          '%' + searchTerm + '%',
          ...filterParams
        ];
        
        const [searchResults, countResult] = await Promise.all([
          ctx.prisma.$queryRawUnsafe<any[]>(relevanceQuery, ...queryParams),
          ctx.prisma.$queryRawUnsafe<{ count: bigint }[]>(countQuery, ...countParams),
        ]);
        
        const total = Number(countResult[0]?.count || 0);
        
        // Fetch related data (prices)
        const cardIds = searchResults.map(r => r.id);
        const prices = await ctx.prisma.cardPrice.findMany({
          where: { cardId: { in: cardIds } },
          orderBy: { updatedAt: 'desc' },
        });
        
        // Group prices by card
        const pricesByCard = prices.reduce((acc, price) => {
          if (!acc[price.cardId]) acc[price.cardId] = [];
          acc[price.cardId].push(price);
          return acc;
        }, {} as Record<string, typeof prices>);
        
        // Format results
        const cards = searchResults.map(result => ({
          ...result,
          set: {
            id: result.set_id,
            name: result.set_name,
          },
          prices: pricesByCard[result.id]?.slice(0, 1) || [],
        }));
        
        return {
          cards,
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        console.error('Optimized search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search cards',
        });
      }
    }),
  
  /**
   * Advanced card search with comprehensive filtering (legacy)
   */
  search: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      filters: cardSearchFiltersSchema.optional(),
      pagination: paginationSchema,
      sort: sortSchema,
      includeOwnedStatus: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { query, filters, pagination, sort, includeOwnedStatus } = input;
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;
      
      try {
        // Build search query
        const where: Record<string, any> = {};
        
        // Text search - only search card names, not set names
        if (query && query.trim()) {
          where.name = { contains: query, mode: 'insensitive' };
        }
      
      // Apply filters
      if (filters) {
        // Card attributes
        if (filters.types?.length) {
          where.types = { hasSome: filters.types };
        }
        if (filters.supertype) {
          where.supertype = filters.supertype;
        }
        if (filters.subtypes?.length) {
          where.subtypes = { hasSome: filters.subtypes };
        }
        if (filters.evolvesFrom) {
          where.evolvesFrom = filters.evolvesFrom;
        }
        if (filters.evolvesTo?.length) {
          where.evolvesTo = { hasSome: filters.evolvesTo };
        }
        
        // Set and legality
        if (filters.setId) {
          where.setId = filters.setId;
        }
        if (filters.series) {
          where.set = { series: filters.series };
        }
        if (filters.rarity?.length) {
          where.rarity = { in: filters.rarity };
        }
        if (filters.isLegalStandard !== undefined) {
          where.legalities = { standard: filters.isLegalStandard ? 'LEGAL' : { not: 'LEGAL' } };
        }
        if (filters.isLegalExpanded !== undefined) {
          where.legalities = { expanded: filters.isLegalExpanded ? 'LEGAL' : { not: 'LEGAL' } };
        }
        
        // Stats
        if (filters.hp) {
          const hpConditions: any[] = [];
          if (filters.hp.min !== undefined) {
            hpConditions.push({ hp: { gte: filters.hp.min } });
          }
          if (filters.hp.max !== undefined) {
            hpConditions.push({ hp: { lte: filters.hp.max } });
          }
          if (hpConditions.length > 0) {
            where.AND = [...(where.AND || []), ...hpConditions];
          }
        }
        
        if (filters.retreatCost) {
          const retreatConditions: any[] = [];
          if (filters.retreatCost.min !== undefined) {
            retreatConditions.push({ convertedRetreatCost: { gte: filters.retreatCost.min } });
          }
          if (filters.retreatCost.max !== undefined) {
            retreatConditions.push({ convertedRetreatCost: { lte: filters.retreatCost.max } });
          }
          if (retreatConditions.length > 0) {
            where.AND = [...(where.AND || []), ...retreatConditions];
          }
        }
        
        // Price filter
        if (filters.priceRange) {
          const priceConditions: any[] = [];
          if (filters.priceRange.min !== undefined || filters.priceRange.max !== undefined) {
            priceConditions.push({
              prices: {
                some: {
                  marketPrice: {
                    gte: filters.priceRange.min || 0,
                    lte: filters.priceRange.max || 999999,
                  },
                },
              },
            });
          }
          if (priceConditions.length > 0) {
            where.AND = [...(where.AND || []), ...priceConditions];
          }
        }
        
        // Owned cards filter
        if (filters.ownedOnly && ctx.userId) {
          const user = await ctx.prisma.user.findUnique({
            where: { clerkUserId: ctx.userId },
            select: { id: true },
          });
          
          if (user) {
            where.userCollections = {
              some: { userId: user.id },
            };
          }
        }
        
        // Abilities and attacks
        if (filters.hasAbility !== undefined) {
          where.abilities = filters.hasAbility ? { some: {} } : { none: {} };
        }
        
        if (filters.attackCount) {
          const attackConditions: any[] = [];
          if (filters.attackCount.min !== undefined) {
            attackConditions.push({ attacks: { some: {} } });
          }
          // Note: Prisma doesn't support direct count filtering, would need raw query
          // This is a simplified version
        }
        
        // Weaknesses and resistances
        if (filters.weaknessTypes?.length) {
          where.weaknesses = {
            some: { type: { in: filters.weaknessTypes } },
          };
        }
        if (filters.resistanceTypes?.length) {
          where.resistances = {
            some: { type: { in: filters.resistanceTypes } },
          };
        }
      }
      
      // Build order by
      const orderBy: Record<string, any> = {};
      switch (sort.field) {
        case 'price':
          orderBy.prices = {
            _min: {
              marketPrice: sort.direction,
            },
          };
          break;
        case 'releaseDate':
          orderBy.set = {
            releaseDate: sort.direction,
          };
          break;
        case 'hp':
          orderBy.hp = sort.direction;
          break;
        case 'retreatCost':
          orderBy.convertedRetreatCost = sort.direction;
          break;
        case 'number':
          orderBy.number = sort.direction;
          break;
        default:
          orderBy[sort.field] = sort.direction;
      }
      
      // Execute query
      const [cards, total] = await ctx.prisma.$transaction([
        ctx.prisma.card.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            ...(includeOwnedStatus && ctx.userId ? {
              userCollections: {
                where: {
                  user: { clerkUserId: ctx.userId },
                },
                select: {
                  quantity: true,
                  condition: true,
                },
              },
            } : {}),
          },
        }),
        ctx.prisma.card.count({ where }),
      ]);
      
        return {
          cards,
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        console.error('Card search error:', error);
        console.error('Query:', query);
        console.error('Where clause:', JSON.stringify(where, null, 2));
        
        if (error instanceof Error && error.message.includes('Invalid')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Search query error: ${error.message}`,
          });
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search cards',
          cause: error,
        });
      }
    }),
  
  /**
   * Get card by ID with full details
   */
  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      // Check cache first
      const cacheKey = `card:${input}`;
      const cached = await getCardCache(cacheKey);
      if (cached) {
        return cached;
      }
      
      const card = await ctx.prisma.card.findUnique({
        where: { id: input },
        include: {
          set: true,
          prices: {
            orderBy: { updatedAt: 'desc' },
          },
        },
      });
      
      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found',
        });
      }
      
      // Convert Decimal prices to numbers for serialization
      const cardWithPrices = {
        ...card,
        prices: card.prices.map(price => ({
          ...price,
          price: price.price.toString(), // Convert Decimal to string
          marketPrice: price.marketPrice?.toString() || null,
        })),
      };
      
      // Cache for 24 hours
      await redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(cardWithPrices));
      
      return cardWithPrices;
    }),
  
  /**
   * Bulk card retrieval
   */
  getBulk: publicProcedure
    .input(z.object({
      cardIds: z.array(z.string()).max(100),
      includeDetails: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { cardIds, includeDetails } = input;
      
      const cards = await ctx.prisma.card.findMany({
        where: { id: { in: cardIds } },
        include: {
          set: true,
          ...(includeDetails ? {
            attacks: true,
            abilities: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          } : {}),
        },
      });
      
      // Return in the same order as requested
      const cardMap = new Map(cards.map(card => [card.id, card]));
      return cardIds.map(id => cardMap.get(id)).filter(Boolean);
    }),
  
  /**
   * Get sets with filtering
   */
  getSets: publicProcedure
    .input(z.object({
      series: z.string().optional(),
      legalInStandard: z.boolean().optional(),
      legalInExpanded: z.boolean().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, any> = {};
      
      if (input.series) {
        where.series = input.series;
      }
      if (input.legalInStandard !== undefined) {
        where.isLegalStandard = input.legalInStandard;
      }
      if (input.legalInExpanded !== undefined) {
        where.isLegalExpanded = input.legalInExpanded;
      }
      if (input.search) {
        where.name = { contains: input.search, mode: 'insensitive' };
      }
      
      return ctx.prisma.set.findMany({
        where,
        orderBy: { releaseDate: 'desc' },
        include: {
          _count: {
            select: { cards: true },
          },
        },
      });
    }),
  
  /**
   * Get cards by set with completion tracking
   */
  getBySet: publicProcedure
    .input(z.object({
      setId: z.string(),
      includeOwnedStatus: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { setId, includeOwnedStatus } = input;
      
      let userId: string | undefined;
      if (includeOwnedStatus && ctx.userId) {
        const user = await ctx.prisma.user.findUnique({
          where: { clerkUserId: ctx.userId },
          select: { id: true },
        });
        userId = user?.id;
      }
      
      const cards = await ctx.prisma.card.findMany({
        where: { setId },
        orderBy: [
          { collectorNumber: 'asc' },
          { name: 'asc' },
        ],
        include: {
          prices: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          ...(userId ? {
            userCollections: {
              where: { userId },
              select: {
                quantity: true,
                condition: true,
              },
            },
          } : {}),
        },
      });
      
      // Calculate set completion if user is logged in
      let completion = null;
      if (userId) {
        const ownedCount = cards.filter(card => 
          card.userCollections && card.userCollections.length > 0
        ).length;
        
        completion = {
          total: cards.length,
          owned: ownedCount,
          percentage: Math.round((ownedCount / cards.length) * 100),
        };
      }
      
      return {
        cards,
        completion,
      };
    }),
  
  /**
   * Get similar cards (for recommendations)
   */
  getSimilar: publicProcedure
    .input(z.object({
      cardId: z.string(),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { cardId, limit } = input;
      
      // Get the source card
      const sourceCard = await ctx.prisma.card.findUnique({
        where: { id: cardId },
        include: {
          attacks: true,
          abilities: true,
        },
      });
      
      if (!sourceCard) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found',
        });
      }
      
      // Find similar cards based on various criteria
      const similar = await ctx.prisma.card.findMany({
        where: {
          AND: [
            { id: { not: cardId } },
            {
              OR: [
                // Same Pokemon name (different versions)
                { name: { contains: sourceCard.name.split(' ')[0] } },
                // Same types
                { types: { hasSome: sourceCard.types } },
                // Similar HP
                {
                  hp: {
                    gte: sourceCard.hp ? sourceCard.hp - 20 : 0,
                    lte: sourceCard.hp ? sourceCard.hp + 20 : 300,
                  },
                },
                // Same stage
                { subtypes: { hasSome: sourceCard.subtypes } },
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
        orderBy: {
          set: {
            releaseDate: 'desc',
          },
        },
      });
      
      return similar;
    }),
  
  /**
   * Get popular cards
   */
  getPopular: publicProcedure
    .input(z.object({
      timeframe: z.enum(['day', 'week', 'month', 'all']).default('week'),
      limit: z.number().min(1).max(50).default(20),
      format: z.enum(['standard', 'expanded', 'all']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { timeframe, limit, format } = input;
      
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
      
      const where: Record<string, any> = {};
      if (timeframe !== 'all') {
        where.deckCards = {
          some: {
            deck: {
              updatedAt: { gte: dateThreshold },
            },
          },
        };
      }
      
      if (format && format !== 'all') {
        where.legalities = {
          [format]: 'LEGAL',
        };
      }
      
      // Get popular cards based on deck usage
      const popular = await ctx.prisma.card.findMany({
        where,
        take: limit,
        include: {
          set: true,
          prices: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              deckCards: true,
            },
          },
        },
        orderBy: {
          deckCards: {
            _count: 'desc',
          },
        },
      });
      
      return popular;
    }),
  
  /**
   * Get recently added cards
   */
  getRecent: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      daysBack: z.number().min(1).max(30).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, daysBack } = input;
      
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);
      
      return ctx.prisma.card.findMany({
        where: {
          createdAt: { gte: dateThreshold },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          set: true,
          prices: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
    }),
  
  /**
   * Validate cards for deck building
   */
  validateForDeck: publicProcedure
    .input(z.object({
      cards: z.array(z.object({
        cardId: z.string(),
        quantity: z.number().min(1).max(4),
      })),
      format: z.enum(['standard', 'expanded', 'unlimited']),
    }))
    .query(async ({ ctx, input }) => {
      const { cards, format } = input;
      
      const cardIds = cards.map(c => c.cardId);
      const cardData = await ctx.prisma.card.findMany({
        where: { id: { in: cardIds } },
        include: {
          legalities: true,
        },
      });
      
      const cardMap = new Map(cardData.map(c => [c.id, c]));
      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };
      
      // Check format legality
      if (format !== 'unlimited') {
        for (const { cardId, quantity } of cards) {
          const card = cardMap.get(cardId);
          if (!card) {
            validation.errors.push(`Card ${cardId} not found`);
            validation.valid = false;
            continue;
          }
          
          const legality = card.legalities?.[format];
          if (legality !== 'LEGAL') {
            validation.errors.push(`${card.name} is not legal in ${format} format`);
            validation.valid = false;
          }
        }
      }
      
      // Check card quantity limits
      const cardCounts = new Map<string, number>();
      for (const { cardId, quantity } of cards) {
        const card = cardMap.get(cardId);
        if (!card) continue;
        
        const currentCount = cardCounts.get(card.name) || 0;
        cardCounts.set(card.name, currentCount + quantity);
        
        if (currentCount + quantity > 4 && !card.name.includes('Energy')) {
          validation.errors.push(`Cannot have more than 4 copies of ${card.name}`);
          validation.valid = false;
        }
      }
      
      // Check deck size
      const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
      if (totalCards !== 60) {
        validation.warnings.push(`Deck has ${totalCards} cards (should be 60)`);
      }
      
      return validation;
    }),
  
  /**
   * Get card price history
   */
  getPriceHistory: publicProcedure
    .input(z.object({
      cardId: z.string(),
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const { cardId, days } = input;
      
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      
      const priceHistory = await ctx.prisma.cardPrice.findMany({
        where: {
          cardId,
          createdAt: { gte: dateThreshold },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          marketPrice: true,
          lowPrice: true,
          highPrice: true,
          avgSellPrice: true,
          createdAt: true,
        },
      });
      
      return {
        cardId,
        history: priceHistory,
        currentPrice: priceHistory[priceHistory.length - 1] || null,
      };
    }),
  
  /**
   * Refresh card prices (premium feature)
   */
  refreshPrices: premiumProcedure
    .input(z.object({
      cardIds: z.array(z.string()).max(50),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { cardIds, priority } = input;
      
      // Queue price update jobs
      const jobs = await Promise.all(
        cardIds.map(cardId =>
          pokemonTCGQueue.add('updateCardPrice', { cardId }, {
            priority: priority === 'high' ? 1 : priority === 'normal' ? 5 : 10,
          })
        )
      );
      
      return {
        queued: jobs.length,
        jobIds: jobs.map(job => job.id),
      };
    }),
});