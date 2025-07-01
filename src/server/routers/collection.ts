import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, premiumProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { CardCondition, Rarity, Supertype } from '@prisma/client';
import { redis } from '@/server/db/redis';
import { pokemonTCGQueue } from '@/lib/jobs/queue-wrapper';
import { getDbUser } from '@/lib/auth/clerk';
import { 
  requireResourcePermission,
  requireSubscriptionFeature,
  checkCollectionLimit,
  requireBulkOperationPermission,
  rateLimitBySubscription,
  auditLog
} from '@/server/api/middleware/permissions';

// Validation schemas
const collectionFilterSchema = z.object({
  // Card filters
  search: z.string().optional(),
  sets: z.array(z.string()).optional(),
  series: z.string().optional(),
  types: z.array(z.string()).optional(),
  supertype: z.nativeEnum(Supertype).optional(),
  rarity: z.array(z.nativeEnum(Rarity)).optional(),
  
  // Collection filters
  condition: z.array(z.nativeEnum(CardCondition)).optional(),
  language: z.array(z.string()).optional(),
  isWishlist: z.boolean().optional(),
  isForTrade: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  
  // Value filters
  priceRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  
  // Date filters
  acquiredAfter: z.date().optional(),
  acquiredBefore: z.date().optional(),
});

const bulkAddSchema = z.object({
  cards: z.array(z.object({
    cardId: z.string(),
    quantity: z.number().min(1),
    quantityFoil: z.number().min(0).default(0),
    condition: z.nativeEnum(CardCondition).default(CardCondition.NEAR_MINT),
    language: z.string().default('EN'),
    purchasePrice: z.number().optional(),
    notes: z.string().optional(),
  })).max(100),
});

export const collectionRouter = createTRPCRouter({
  /**
   * Check if cards are in user's collection
   */
  checkCardsInCollection: protectedProcedure
    .input(z.object({
      cardIds: z.array(z.string()).max(100),
    }))
    .query(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check which cards are basic energy cards
      const cards = await ctx.prisma.card.findMany({
        where: { id: { in: input.cardIds } },
        select: {
          id: true,
          name: true,
          supertype: true,
        },
      });

      const basicEnergyNames = [
        'Grass Energy', 'Fire Energy', 'Water Energy', 'Lightning Energy',
        'Psychic Energy', 'Fighting Energy', 'Darkness Energy', 'Metal Energy', 'Fairy Energy'
      ];

      const basicEnergyCardIds = new Set(
        cards
          .filter(c => c.supertype === 'ENERGY' && basicEnergyNames.includes(c.name))
          .map(c => c.id)
      );

      const userCollectionCards = await ctx.prisma.userCollection.findMany({
        where: {
          userId: user.id,
          cardId: { in: input.cardIds },
          onWishlist: false,
        },
        select: {
          cardId: true,
        },
      });

      const inCollectionSet = new Set(userCollectionCards.map(uc => uc.cardId));
      
      return input.cardIds.reduce((acc, cardId) => {
        // Basic energy cards are always in collection
        acc[cardId] = basicEnergyCardIds.has(cardId) || inCollectionSet.has(cardId);
        return acc;
      }, {} as Record<string, boolean>);
    }),

  /**
   * Get comprehensive collection dashboard data
   */
  getDashboard: protectedProcedure
    .use(requireResourcePermission('collection', 'read'))
    .use(rateLimitBySubscription('collection:dashboard'))
    .query(async ({ ctx }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Cache key for dashboard
      const cacheKey = `collection:dashboard:${user.id}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Aggregate collection statistics
      const [
        totalStats,
        conditionBreakdown,
        typeBreakdown,
        setBreakdown,
        rarityBreakdown,
        recentCards,
        topValueCards,
        wishlistCount,
        tradeableCount,
      ] = await ctx.prisma.$transaction([
        // Total collection stats
        ctx.prisma.userCollection.aggregate({
          where: { userId: user.id, onWishlist: false },
          _sum: {
            quantity: true,
            quantityFoil: true,
            purchasePrice: true,
          },
          _count: true,
        }),
        
        // Condition breakdown
        ctx.prisma.userCollection.groupBy({
          by: ['condition'],
          where: { userId: user.id, onWishlist: false },
          _sum: { quantity: true, quantityFoil: true },
        }),
        
        // Type breakdown
        ctx.prisma.$queryRaw`
          SELECT c.supertype, COUNT(DISTINCT uc."cardId") as count, 
                 SUM(uc.quantity + uc."quantityFoil") as total_quantity
          FROM "UserCollection" uc
          JOIN "Card" c ON c.id = uc."cardId"
          WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
          GROUP BY c.supertype
        `,
        
        // Set breakdown with completion
        ctx.prisma.$queryRaw`
          SELECT s.id, s.name, s.series, s."symbolUrl",
                 COUNT(DISTINCT c.id) as total_cards_in_set,
                 COUNT(DISTINCT uc."cardId") as owned_cards,
                 ROUND(COUNT(DISTINCT uc."cardId")::numeric / COUNT(DISTINCT c.id) * 100, 2) as completion_percentage
          FROM "Set" s
          JOIN "Card" c ON c."setId" = s.id
          LEFT JOIN "UserCollection" uc ON uc."cardId" = c.id AND uc."userId" = ${user.id} AND uc."isWishlist" = false
          GROUP BY s.id, s.name, s.series, s."symbolUrl"
          HAVING COUNT(DISTINCT uc."cardId") > 0
          ORDER BY completion_percentage DESC
          LIMIT 10
        `,
        
        // Rarity breakdown
        ctx.prisma.userCollection.groupBy({
          by: ['card.rarity'],
          where: { userId: user.id, onWishlist: false },
          _count: true,
        }),
        
        // Recent additions
        ctx.prisma.userCollection.findMany({
          where: { userId: user.id, onWishlist: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
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
        
        // Top value cards
        ctx.prisma.$queryRaw`
          SELECT uc.*, c.name, c."imageUrlHiRes", s.name as set_name, cp."marketPrice"
          FROM "UserCollection" uc
          JOIN "Card" c ON c.id = uc."cardId"
          JOIN "Set" s ON s.id = c."setId"
          LEFT JOIN LATERAL (
            SELECT "marketPrice" FROM "CardPrice" 
            WHERE "cardId" = c.id 
            ORDER BY "updatedAt" DESC 
            LIMIT 1
          ) cp ON true
          WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
          ORDER BY cp."marketPrice" DESC NULLS LAST
          LIMIT 10
        `,
        
        // Wishlist count
        ctx.prisma.userCollection.count({
          where: { userId: user.id, isWishlist: true },
        }),
        
        // Tradeable count
        ctx.prisma.userCollection.count({
          where: { userId: user.id, isForTrade: true },
        }),
      ]);

      // Calculate total value based on current market prices
      const totalValue = await ctx.prisma.$queryRaw`
        SELECT SUM((uc.quantity + uc."quantityFoil") * COALESCE(cp."marketPrice", 0)) as total_value
        FROM "UserCollection" uc
        LEFT JOIN LATERAL (
          SELECT "marketPrice" FROM "CardPrice" 
          WHERE "cardId" = uc."cardId" 
          ORDER BY "updatedAt" DESC 
          LIMIT 1
        ) cp ON true
        WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
      `;

      const dashboard = {
        summary: {
          totalCards: (totalStats._sum.quantity || 0) + (totalStats._sum.quantityFoil || 0),
          uniqueCards: totalStats._count,
          totalValue: totalValue[0]?.total_value || 0,
          purchaseValue: totalStats._sum.purchasePrice || 0,
          wishlistCount,
          tradeableCount,
        },
        breakdowns: {
          condition: conditionBreakdown,
          type: typeBreakdown,
          set: setBreakdown,
          rarity: rarityBreakdown,
        },
        recentAdditions: recentCards,
        topValueCards,
      };

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, dashboard);

      return dashboard;
    }),

  /**
   * Advanced collection search with filtering
   */
  searchCards: protectedProcedure
    .input(z.object({
      filters: collectionFilterSchema,
      pagination: z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      }),
      sort: z.object({
        field: z.enum(['name', 'value', 'quantity', 'acquiredDate', 'set']).default('name'),
        direction: z.enum(['asc', 'desc']).default('asc'),
      }),
    }))
    .query(async ({ ctx, input }) => {
      const { filters, pagination, sort } = input;
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Build where clause
      const where: Record<string, any> = {
        userId: user.id,
      };

      if (filters.isWishlist !== undefined) {
        where.onWishlist = filters.isWishlist;
      }
      if (filters.isForTrade !== undefined) {
        where.isForTrade = filters.isForTrade;
      }
      if (filters.condition?.length) {
        where.condition = { in: filters.condition };
      }
      if (filters.language?.length) {
        where.language = { in: filters.language };
      }
      if (filters.tags?.length) {
        where.tags = { hasSome: filters.tags };
      }
      if (filters.acquiredAfter || filters.acquiredBefore) {
        where.acquiredDate = {};
        if (filters.acquiredAfter) {
          where.acquiredDate.gte = filters.acquiredAfter;
        }
        if (filters.acquiredBefore) {
          where.acquiredDate.lte = filters.acquiredBefore;
        }
      }

      // Card-level filters
      const cardWhere: Record<string, any> = {};
      if (filters.search) {
        cardWhere.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { flavorText: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      if (filters.sets?.length) {
        cardWhere.setId = { in: filters.sets };
      }
      if (filters.series) {
        cardWhere.set = { series: filters.series };
      }
      if (filters.types?.length) {
        cardWhere.types = { hasSome: filters.types };
      }
      if (filters.supertype) {
        cardWhere.supertype = filters.supertype;
      }
      if (filters.rarity?.length) {
        cardWhere.rarity = { in: filters.rarity };
      }

      if (Object.keys(cardWhere).length > 0) {
        where.card = cardWhere;
      }

      // Build order by
      let orderBy: any = {};
      switch (sort.field) {
        case 'name':
          orderBy = { card: { name: sort.direction } };
          break;
        case 'value':
          // This requires a join with prices, handled separately
          orderBy = { card: { name: sort.direction } };
          break;
        case 'quantity':
          orderBy = { quantity: sort.direction };
          break;
        case 'acquiredDate':
          orderBy = { acquiredDate: sort.direction };
          break;
        case 'set':
          orderBy = { card: { set: { releaseDate: sort.direction } } };
          break;
      }

      const [cards, total] = await ctx.prisma.$transaction([
        ctx.prisma.userCollection.findMany({
          where,
          skip,
          take: limit,
          orderBy,
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
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Add card to collection
   */
  addCard: protectedProcedure
    .input(z.object({
      cardId: z.string(),
      quantity: z.number().min(1).default(1),
      quantityFoil: z.number().min(0).default(0),
      condition: z.nativeEnum(CardCondition).default(CardCondition.NEAR_MINT),
      language: z.string().default('EN'),
      purchasePrice: z.number().optional(),
      acquiredDate: z.date().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      storageLocation: z.string().optional(),
      isWishlist: z.boolean().default(false),
      isForTrade: z.boolean().default(false),
      wishlistPriority: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if card exists
      const card = await ctx.prisma.card.findUnique({
        where: { id: input.cardId },
      });

      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found',
        });
      }

      // Check if this is a basic energy card
      const basicEnergyNames = [
        'Grass Energy', 'Fire Energy', 'Water Energy', 'Lightning Energy',
        'Psychic Energy', 'Fighting Energy', 'Darkness Energy', 'Metal Energy', 'Fairy Energy'
      ];
      
      const isBasicEnergy = card.supertype === 'ENERGY' && basicEnergyNames.includes(card.name);

      // Check for existing card with same attributes
      const existing = await ctx.prisma.userCollection.findFirst({
        where: {
          userId: user.id,
          cardId: input.cardId,
          condition: input.condition,
          onWishlist: input.isWishlist,
        },
      });

      if (existing) {
        // Update quantities
        const updated = await ctx.prisma.userCollection.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + input.quantity,
            quantityFoil: existing.quantityFoil + input.quantityFoil,
            isForTrade: input.isForTrade || existing.isForTrade,
            notes: input.notes || existing.notes,
            tags: input.tags ? [...new Set([...(existing.tags || []), ...input.tags])] : existing.tags,
            storageLocation: input.storageLocation || existing.storageLocation,
          },
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
        });

        // Invalidate cache
        await redis.del(`collection:dashboard:${user.id}`);

        return updated;
      }

      // Create new collection entry
      const created = await ctx.prisma.userCollection.create({
        data: {
          userId: user.id,
          cardId: input.cardId,
          quantity: isBasicEnergy ? 9999 : input.quantity,
          quantityFoil: input.quantityFoil,
          condition: input.condition,
          language: input.language,
          purchasePrice: input.purchasePrice,
          acquiredAt: input.acquiredDate || new Date(),
          notes: isBasicEnergy ? 'Basic energy - unlimited quantity' : input.notes,
          onWishlist: input.isWishlist,
          forTrade: input.isForTrade,
          tags: input.tags || [],
          location: input.storageLocation as any || 'BINDER',
        },
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
      });

      // Invalidate cache
      await redis.del(`collection:dashboard:${user.id}`);

      return created;
    }),

  /**
   * Bulk add cards to collection
   */
  bulkAddCards: protectedProcedure
    .input(bulkAddSchema)
    .mutation(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Validate all cards exist
      const cardIds = input.cards.map(item => item.cardId);
      const existingCards = await ctx.prisma.card.findMany({
        where: { id: { in: cardIds } },
        select: { id: true },
      });

      const existingCardIds = new Set(existingCards.map(c => c.id));
      const invalidCards = cardIds.filter(id => !existingCardIds.has(id));

      if (invalidCards.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid card IDs: ${invalidCards.join(', ')}`,
        });
      }

      // Process bulk add
      const results = await ctx.prisma.$transaction(
        async (prisma) => {
          const addedCards = [];
          
          for (const item of input.cards) {
            // Check if card already exists
            const existing = await prisma.userCollection.findFirst({
              where: {
                userId: user.id,
                cardId: item.cardId,
                condition: item.condition,
                onWishlist: false,
              },
            });

            if (existing) {
              // Update existing
              const updated = await prisma.userCollection.update({
                where: { id: existing.id },
                data: {
                  quantity: existing.quantity + item.quantity,
                  quantityFoil: existing.quantityFoil + item.quantityFoil,
                },
              });
              addedCards.push(updated);
            } else {
              // Create new
              const created = await prisma.userCollection.create({
                data: {
                  ...item,
                  userId: user.id,
                  onWishlist: false,
                  acquiredAt: new Date(),
                },
              });
              addedCards.push(created);
            }
          }
          
          return addedCards;
        }
      );

      // Invalidate cache
      await redis.del(`collection:dashboard:${user.id}`);

      // Queue collection indexing job
      await pokemonTCGQueue.add('indexCollection', { userId: user.id }, { delay: 5000 });

      return {
        added: results.length,
        cards: results,
      };
    }),

  /**
   * Update collection card
   */
  updateCard: protectedProcedure
    .input(z.object({
      id: z.string(),
      quantity: z.number().min(0).optional(),
      quantityFoil: z.number().min(0).optional(),
      condition: z.nativeEnum(CardCondition).optional(),
      language: z.string().optional(),
      purchasePrice: z.number().optional(),
      acquiredDate: z.date().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      storageLocation: z.string().optional(),
      isForTrade: z.boolean().optional(),
      wishlistPriority: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

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
        await ctx.prisma.userCollection.delete({
          where: { id },
        });

        // Invalidate cache
        await redis.del(`collection:dashboard:${user.id}`);

        return { deleted: true };
      }

      const updated = await ctx.prisma.userCollection.update({
        where: { id },
        data: updateData,
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
      });

      // Invalidate cache
      await redis.del(`collection:dashboard:${user.id}`);

      return updated;
    }),

  /**
   * Remove card from collection by cardId
   */
  removeCardByCardId: protectedProcedure
    .input(z.object({
      cardId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Find the user's collection entry for this card
      const userCollection = await ctx.prisma.userCollection.findFirst({
        where: {
          userId: user.id,
          cardId: input.cardId,
          onWishlist: false,
        },
      });

      if (!userCollection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found in collection',
        });
      }

      // Delete the collection entry
      await ctx.prisma.userCollection.delete({
        where: { id: userCollection.id },
      });

      // Invalidate cache
      await redis.del(`collection:dashboard:${user.id}`);

      return { deleted: true, cardId: input.cardId };
    }),

  /**
   * Get collection statistics
   */
  getStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get comprehensive statistics
      const [
        totalValue,
        valueBySet,
        valueByRarity,
        monthlySpending,
        collectionGrowth,
        duplicates,
      ] = await ctx.prisma.$transaction([
        // Total collection value
        ctx.prisma.$queryRaw`
          SELECT 
            SUM((uc.quantity + uc."quantityFoil") * COALESCE(cp."marketPrice", 0)) as market_value,
            SUM(uc."purchasePrice") as purchase_value,
            COUNT(DISTINCT uc."cardId") as unique_cards,
            SUM(uc.quantity + uc."quantityFoil") as total_cards
          FROM "UserCollection" uc
          LEFT JOIN LATERAL (
            SELECT "marketPrice" FROM "CardPrice" 
            WHERE "cardId" = uc."cardId" 
            ORDER BY "updatedAt" DESC 
            LIMIT 1
          ) cp ON true
          WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
        `,
        
        // Value breakdown by set
        ctx.prisma.$queryRaw`
          SELECT s.name, s.series, 
                 SUM((uc.quantity + uc."quantityFoil") * COALESCE(cp."marketPrice", 0)) as value,
                 COUNT(DISTINCT c.id) as unique_cards
          FROM "UserCollection" uc
          JOIN "Card" c ON c.id = uc."cardId"
          JOIN "Set" s ON s.id = c."setId"
          LEFT JOIN LATERAL (
            SELECT "marketPrice" FROM "CardPrice" 
            WHERE "cardId" = c.id 
            ORDER BY "updatedAt" DESC 
            LIMIT 1
          ) cp ON true
          WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
          GROUP BY s.id, s.name, s.series
          ORDER BY value DESC
          LIMIT 20
        `,
        
        // Value breakdown by rarity
        ctx.prisma.$queryRaw`
          SELECT c.rarity,
                 SUM((uc.quantity + uc."quantityFoil") * COALESCE(cp."marketPrice", 0)) as value,
                 COUNT(DISTINCT c.id) as count
          FROM "UserCollection" uc
          JOIN "Card" c ON c.id = uc."cardId"
          LEFT JOIN LATERAL (
            SELECT "marketPrice" FROM "CardPrice" 
            WHERE "cardId" = c.id 
            ORDER BY "updatedAt" DESC 
            LIMIT 1
          ) cp ON true
          WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
          GROUP BY c.rarity
          ORDER BY value DESC
        `,
        
        // Monthly spending
        ctx.prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('month', uc."acquiredDate") as month,
            SUM(uc."purchasePrice") as spent,
            COUNT(*) as cards_added
          FROM "UserCollection" uc
          WHERE uc."userId" = ${user.id} 
            AND uc."isWishlist" = false 
            AND uc."acquiredDate" >= NOW() - INTERVAL '12 months'
          GROUP BY month
          ORDER BY month DESC
        `,
        
        // Collection growth over time
        ctx.prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('week', uc."createdAt") as week,
            COUNT(*) as cards_added,
            SUM(uc.quantity + uc."quantityFoil") as total_added
          FROM "UserCollection" uc
          WHERE uc."userId" = ${user.id} 
            AND uc."isWishlist" = false
            AND uc."createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY week
          ORDER BY week
        `,
        
        // Find duplicates
        ctx.prisma.$queryRaw`
          SELECT c.id, c.name, s.name as set_name,
                 SUM(uc.quantity + uc."quantityFoil") as total_owned,
                 COUNT(*) as different_conditions
          FROM "UserCollection" uc
          JOIN "Card" c ON c.id = uc."cardId"
          JOIN "Set" s ON s.id = c."setId"
          WHERE uc."userId" = ${user.id} AND uc."isWishlist" = false
          GROUP BY c.id, c.name, s.name
          HAVING SUM(uc.quantity + uc."quantityFoil") > 4
          ORDER BY total_owned DESC
          LIMIT 20
        `,
      ]);

      return {
        summary: totalValue[0] || {},
        valueBySet,
        valueByRarity,
        monthlySpending,
        collectionGrowth,
        duplicates,
      };
    }),

  /**
   * Get want list with market data
   */
  getWantList: protectedProcedure
    .input(z.object({
      sortBy: z.enum(['priority', 'price', 'name']).default('priority'),
      budget: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const wantList = await ctx.prisma.userCollection.findMany({
        where: {
          userId: user.id,
          onWishlist: true,
        },
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
        orderBy: input.sortBy === 'priority' 
          ? { wishlistPriority: 'desc' }
          : input.sortBy === 'name'
          ? { card: { name: 'asc' } }
          : undefined,
      });

      // Calculate total cost and apply budget filtering
      let totalCost = 0;
      const prioritizedList = [];
      
      for (const item of wantList) {
        const price = item.card.prices[0]?.marketPrice || 0;
        const itemCost = price * (item.quantity + item.quantityFoil);
        
        if (input.budget && totalCost + itemCost > input.budget) {
          continue;
        }
        
        totalCost += itemCost;
        prioritizedList.push({
          ...item,
          estimatedCost: itemCost,
        });
      }

      return {
        items: prioritizedList,
        totalCost,
        totalItems: prioritizedList.length,
      };
    }),

  /**
   * Import collection from CSV/JSON
   */
  importCollection: protectedProcedure
    .input(z.object({
      format: z.enum(['csv', 'json', 'tcgdb']),
      data: z.string(),
      options: z.object({
        skipDuplicates: z.boolean().default(false),
        updateExisting: z.boolean().default(false),
        defaultCondition: z.nativeEnum(CardCondition).default(CardCondition.NEAR_MINT),
        defaultLanguage: z.string().default('EN'),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Queue import job
      const job = await pokemonTCGQueue.add('importCollection', {
        userId: user.id,
        format: input.format,
        data: input.data,
        options: input.options,
      });

      return {
        jobId: job.id,
        message: 'Collection import queued for processing',
      };
    }),

  /**
   * Export collection
   */
  exportCollection: protectedProcedure
    .input(z.object({
      format: z.enum(['csv', 'json', 'tcgdb']),
      includeWishlist: z.boolean().default(false),
      includePrices: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const where: any = { userId: user.id };
      if (!input.includeWishlist) {
        where.isWishlist = false;
      }

      const collection = await ctx.prisma.userCollection.findMany({
        where,
        include: {
          card: {
            include: {
              set: true,
              ...(input.includePrices ? {
                prices: {
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                },
              } : {}),
            },
          },
        },
        orderBy: [
          { card: { set: { releaseDate: 'desc' } } },
          { card: { collectorNumber: 'asc' } },
        ],
      });

      // Format data based on export type
      let exportData: string;
      
      switch (input.format) {
        case 'csv':
          // CSV export
          const headers = [
            'Card Name', 'Set', 'Number', 'Quantity', 'Foil Quantity',
            'Condition', 'Language', 'Purchase Price', 'Market Price',
            'Notes', 'Tags', 'Storage Location'
          ];
          
          const rows = collection.map(item => [
            item.card.name,
            item.card.set.name,
            item.card.collectorNumber,
            item.quantity,
            item.quantityFoil,
            item.condition,
            item.language,
            item.purchasePrice || '',
            input.includePrices ? (item.card.prices[0]?.marketPrice || '') : '',
            item.notes || '',
            (item.tags || []).join(';'),
            item.storageLocation || '',
          ]);
          
          exportData = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
          break;
          
        case 'json':
          // JSON export
          exportData = JSON.stringify(collection, null, 2);
          break;
          
        case 'tcgdb':
          // TCGDB format
          const tcgdbData = collection.map(item => ({
            name: item.card.name,
            set: item.card.set.code,
            number: item.card.collectorNumber,
            quantity: item.quantity + item.quantityFoil,
            condition: item.condition,
          }));
          exportData = JSON.stringify(tcgdbData, null, 2);
          break;
          
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid export format',
          });
      }

      return {
        data: exportData,
        filename: `collection_${new Date().toISOString().split('T')[0]}.${input.format}`,
        mimeType: input.format === 'csv' ? 'text/csv' : 'application/json',
      };
    }),

  /**
   * Create collection snapshot (premium feature)
   */
  createSnapshot: premiumProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use getDbUser to ensure user exists (creates if needed)
      const user = await getDbUser(ctx.userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get current collection state
      const collection = await ctx.prisma.userCollection.findMany({
        where: { userId: user.id },
        include: {
          card: {
            include: {
              prices: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      // Calculate snapshot statistics
      const stats = {
        totalCards: collection.reduce((sum, item) => sum + item.quantity + item.quantityFoil, 0),
        uniqueCards: collection.filter(item => !item.isWishlist).length,
        totalValue: collection.reduce((sum, item) => {
          const price = item.card.prices[0]?.marketPrice || 0;
          return sum + (price * (item.quantity + item.quantityFoil));
        }, 0),
        wishlistCount: collection.filter(item => item.isWishlist).length,
      };

      // Create snapshot (would need CollectionSnapshot model)
      const snapshot = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name,
        description: input.description,
        data: collection,
        stats,
        createdAt: new Date(),
      };

      // In a real implementation, save to database
      // await ctx.prisma.collectionSnapshot.create({ data: snapshot });

      return snapshot;
    }),
});