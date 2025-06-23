import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure, premiumProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
// TCGPlayer client removed - pricing integration disabled
import { getPriceCache } from '@/lib/cache/redis-cache';
import { pokemonTCGQueue } from '@/lib/jobs/queue';

// Validation schemas
const priceHistorySchema = z.object({
  cardId: z.string(),
  days: z.number().min(1).max(365).default(30),
  interval: z.enum(['hour', 'day', 'week']).default('day'),
});

const priceAlertSchema = z.object({
  cardId: z.string(),
  alertType: z.enum(['above', 'below', 'change']),
  threshold: z.number().min(0),
  condition: z.string().default('Near Mint'),
  notifyEmail: z.boolean().default(true),
  notifyApp: z.boolean().default(true),
});

const marketTrendsSchema = z.object({
  timeframe: z.enum(['day', 'week', 'month']).default('week'),
  category: z.enum(['all', 'standard', 'expanded', 'vintage']).default('all'),
  limit: z.number().min(1).max(100).default(20),
});

export const pricingRouter = createTRPCRouter({
  /**
   * Get current price for a card
   */
  getCurrentPrice: publicProcedure
    .input(z.object({
      cardId: z.string(),
      includeVariants: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { cardId, includeVariants } = input;
      
      // TCGPlayer integration removed - returning empty price data
      return {
        cardId,
        cardName: 'Unknown',
        setName: 'Unknown',
        currentPrice: null,
        lastUpdated: null,
        isStale: true,
        variants: [],
        notice: 'Pricing data is currently unavailable. TCGPlayer integration has been removed.',
      };
      
      // Check cache first
      const cacheKey = `price:current:${cardId}`;
      const cached = await getPriceCache().get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Get card with latest price
      const card = await ctx.prisma.card.findUnique({
        where: { id: cardId },
        include: {
          set: true,
          prices: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
      
      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found',
        });
      }
      
      const latestPrice = card.prices[0];
      
      // If price is stale (> 24 hours), queue update
      const isStale = !latestPrice || 
        new Date().getTime() - new Date(latestPrice.updatedAt).getTime() > 24 * 60 * 60 * 1000;
      
      if (isStale) {
        await pokemonTCGQueue.add('updateCardPrice', { cardId }, { priority: 5 });
      }
      
      // Get variant prices if requested
      let variants = [];
      if (includeVariants) {
        // Find cards with same name but different conditions/printings
        const variantCards = await ctx.prisma.card.findMany({
          where: {
            name: card.name,
            id: { not: cardId },
          },
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
          take: 10,
        });
        
        variants = variantCards.map(v => ({
          cardId: v.id,
          setName: v.set.name,
          collectorNumber: v.collectorNumber,
          price: v.prices[0] || null,
        }));
      }
      
      const result = {
        cardId,
        cardName: card.name,
        setName: card.set.name,
        currentPrice: latestPrice || null,
        lastUpdated: latestPrice?.updatedAt || null,
        isStale,
        variants,
      };
      
      // Cache for 1 hour
      await getPriceCache().set(cacheKey, result, 3600);
      
      return result;
    }),
  
  /**
   * Get price history for a card
   */
  getPriceHistory: publicProcedure
    .input(priceHistorySchema)
    .query(async ({ ctx, input }) => {
      const { cardId, days, interval } = input;
      
      // TCGPlayer integration removed - returning empty history
      return {
        cardId,
        history: [],
        summary: {
          current: 0,
          high: 0,
          low: 0,
          average: 0,
          change: 0,
          changePercent: 0,
        },
        notice: 'Price history is currently unavailable. TCGPlayer integration has been removed.',
      };
      
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      
      // Get price history
      const prices = await ctx.prisma.cardPrice.findMany({
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
      
      if (prices.length === 0) {
        // No price history, queue fetch
        await pokemonTCGQueue.add('fetchPriceHistory', { cardId, days }, { priority: 3 });
        
        return {
          cardId,
          history: [],
          summary: {
            current: 0,
            high: 0,
            low: 0,
            average: 0,
            change: 0,
            changePercent: 0,
          },
        };
      }
      
      // Aggregate by interval
      const aggregated = [];
      let currentBucket = null;
      
      for (const price of prices) {
        const bucketKey = getBucketKey(price.createdAt, interval);
        
        if (!currentBucket || currentBucket.key !== bucketKey) {
          if (currentBucket) {
            aggregated.push(currentBucket);
          }
          currentBucket = {
            key: bucketKey,
            date: price.createdAt,
            prices: [],
          };
        }
        
        currentBucket.prices.push(price);
      }
      
      if (currentBucket) {
        aggregated.push(currentBucket);
      }
      
      // Calculate aggregated values
      const history = aggregated.map(bucket => {
        const marketPrices = bucket.prices.map(p => p.marketPrice).filter(Boolean);
        return {
          date: bucket.date,
          marketPrice: average(marketPrices),
          lowPrice: Math.min(...bucket.prices.map(p => p.lowPrice || Infinity)),
          highPrice: Math.max(...bucket.prices.map(p => p.highPrice || 0)),
          avgSellPrice: average(bucket.prices.map(p => p.avgSellPrice).filter(Boolean)),
        };
      });
      
      // Calculate summary statistics
      const allMarketPrices = prices.map(p => p.marketPrice).filter(Boolean);
      const current = allMarketPrices[allMarketPrices.length - 1] || 0;
      const first = allMarketPrices[0] || 0;
      const change = current - first;
      const changePercent = first > 0 ? (change / first) * 100 : 0;
      
      return {
        cardId,
        history,
        summary: {
          current,
          high: Math.max(...allMarketPrices),
          low: Math.min(...allMarketPrices),
          average: average(allMarketPrices),
          change,
          changePercent,
        },
      };
    }),
  
  /**
   * Get market trends
   */
  getMarketTrends: publicProcedure
    .input(marketTrendsSchema)
    .query(async ({ ctx, input }) => {
      const { timeframe, category, limit } = input;
      
      // TCGPlayer integration removed - returning empty trends
      return {
        trends: [],
        summary: {
          total_cards: 0,
          avg_price: 0,
          cards_up: 0,
          cards_down: 0,
          cards_stable: 0,
        },
        timeframe,
        category,
        notice: 'Market trends are currently unavailable. TCGPlayer integration has been removed.',
      };
      
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
      
      // Get trending cards (biggest movers)
      const trends = await ctx.prisma.$queryRaw`
        WITH price_changes AS (
          SELECT 
            c.id,
            c.name,
            s.name as set_name,
            c.rarity,
            c."imageUrl",
            FIRST_VALUE(cp."marketPrice") OVER (PARTITION BY c.id ORDER BY cp."createdAt" DESC) as current_price,
            FIRST_VALUE(cp."marketPrice") OVER (PARTITION BY c.id ORDER BY cp."createdAt" ASC) as old_price,
            COUNT(*) OVER (PARTITION BY c.id) as price_points
          FROM "Card" c
          JOIN "Set" s ON s.id = c."setId"
          JOIN "CardPrice" cp ON cp."cardId" = c.id
          WHERE cp."createdAt" >= ${dateThreshold}
            ${category !== 'all' ? `AND c.legalities->>'${category}' = 'LEGAL'` : ''}
        )
        SELECT 
          id,
          name,
          set_name,
          rarity,
          "imageUrl",
          current_price,
          old_price,
          current_price - old_price as price_change,
          CASE 
            WHEN old_price > 0 THEN ((current_price - old_price) / old_price * 100)
            ELSE 0 
          END as percent_change
        FROM price_changes
        WHERE price_points >= 2
        ORDER BY ABS(percent_change) DESC
        LIMIT ${limit}
      `;
      
      // Get market summary
      const summary = await ctx.prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT c.id) as total_cards,
          AVG(cp."marketPrice") as avg_price,
          SUM(CASE WHEN cp2."marketPrice" > cp1."marketPrice" THEN 1 ELSE 0 END) as cards_up,
          SUM(CASE WHEN cp2."marketPrice" < cp1."marketPrice" THEN 1 ELSE 0 END) as cards_down,
          SUM(CASE WHEN cp2."marketPrice" = cp1."marketPrice" THEN 1 ELSE 0 END) as cards_stable
        FROM "Card" c
        JOIN LATERAL (
          SELECT "marketPrice" FROM "CardPrice" 
          WHERE "cardId" = c.id AND "createdAt" >= ${dateThreshold}
          ORDER BY "createdAt" ASC LIMIT 1
        ) cp1 ON true
        JOIN LATERAL (
          SELECT "marketPrice" FROM "CardPrice" 
          WHERE "cardId" = c.id 
          ORDER BY "createdAt" DESC LIMIT 1
        ) cp2 ON true
        LEFT JOIN LATERAL (
          SELECT "marketPrice" FROM "CardPrice" 
          WHERE "cardId" = c.id 
          ORDER BY "createdAt" DESC LIMIT 1
        ) cp ON true
        ${category !== 'all' ? `WHERE c.legalities->>'${category}' = 'LEGAL'` : ''}
      `;
      
      return {
        trends: trends.map(t => ({
          ...t,
          trend: t.percent_change > 0 ? 'up' : t.percent_change < 0 ? 'down' : 'stable',
        })),
        summary: summary[0] || {},
        timeframe,
        category,
      };
    }),
  
  /**
   * Create price alert
   */
  createPriceAlert: protectedProcedure
    .input(priceAlertSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify card exists
      const card = await ctx.prisma.card.findUnique({
        where: { id: input.cardId },
        select: { id: true, name: true },
      });
      
      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Card not found',
        });
      }
      
      // Check existing alerts limit
      const alertCount = await ctx.prisma.priceAlert.count({
        where: { userId: ctx.user!.id },
      });
      
      const maxAlerts = ctx.userRole === 'premium_user' ? 50 : 
                       ctx.userRole === 'pro_user' ? 100 : 10;
      
      if (alertCount >= maxAlerts) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You have reached the maximum number of price alerts (${maxAlerts})`,
        });
      }
      
      // Create alert
      const alert = await ctx.prisma.priceAlert.create({
        data: {
          userId: ctx.user!.id,
          cardId: input.cardId,
          alertType: input.alertType,
          threshold: input.threshold,
          condition: input.condition,
          notifyEmail: input.notifyEmail,
          notifyApp: input.notifyApp,
          isActive: true,
        },
        include: {
          card: {
            select: {
              name: true,
              set: {
                select: { name: true },
              },
            },
          },
        },
      });
      
      return alert;
    }),
  
  /**
   * Get user's price alerts
   */
  getPriceAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const alerts = await ctx.prisma.priceAlert.findMany({
        where: { userId: ctx.user!.id },
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
        orderBy: { createdAt: 'desc' },
      });
      
      // Add trigger status
      const alertsWithStatus = alerts.map(alert => {
        const currentPrice = alert.card.prices[0]?.marketPrice || 0;
        let triggered = false;
        
        switch (alert.alertType) {
          case 'above':
            triggered = currentPrice > alert.threshold;
            break;
          case 'below':
            triggered = currentPrice < alert.threshold;
            break;
          case 'change':
            // Would need previous price to calculate change
            triggered = false;
            break;
        }
        
        return {
          ...alert,
          currentPrice,
          triggered,
        };
      });
      
      return alertsWithStatus;
    }),
  
  /**
   * Update price alert
   */
  updatePriceAlert: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      threshold: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      notifyApp: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { alertId, ...updateData } = input;
      
      // Verify ownership
      const alert = await ctx.prisma.priceAlert.findUnique({
        where: { id: alertId },
        select: { userId: true },
      });
      
      if (!alert || alert.userId !== ctx.user!.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this alert',
        });
      }
      
      return ctx.prisma.priceAlert.update({
        where: { id: alertId },
        data: updateData,
      });
    }),
  
  /**
   * Delete price alert
   */
  deletePriceAlert: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input: alertId }) => {
      // Verify ownership
      const alert = await ctx.prisma.priceAlert.findUnique({
        where: { id: alertId },
        select: { userId: true },
      });
      
      if (!alert || alert.userId !== ctx.user!.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this alert',
        });
      }
      
      return ctx.prisma.priceAlert.delete({
        where: { id: alertId },
      });
    }),
  
  /**
   * Get portfolio value over time
   */
  getPortfolioValue: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const { days } = input;
      
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      
      // Get user's collection value over time
      const portfolioHistory = await ctx.prisma.$queryRaw`
        WITH daily_values AS (
          SELECT 
            DATE_TRUNC('day', cp."createdAt") as date,
            SUM((uc.quantity + uc."quantityFoil") * cp."marketPrice") as total_value
          FROM "UserCollection" uc
          JOIN "CardPrice" cp ON cp."cardId" = uc."cardId"
          WHERE uc."userId" = ${ctx.user!.id}
            AND uc."isWishlist" = false
            AND cp."createdAt" >= ${dateThreshold}
          GROUP BY DATE_TRUNC('day', cp."createdAt")
        )
        SELECT 
          date,
          total_value,
          LAG(total_value) OVER (ORDER BY date) as previous_value,
          total_value - LAG(total_value) OVER (ORDER BY date) as daily_change
        FROM daily_values
        ORDER BY date
      `;
      
      // Get current portfolio summary
      const currentValue = await ctx.prisma.$queryRaw`
        SELECT 
          SUM((uc.quantity + uc."quantityFoil") * COALESCE(cp."marketPrice", 0)) as market_value,
          SUM(uc."purchasePrice") as cost_basis,
          COUNT(DISTINCT uc."cardId") as unique_cards
        FROM "UserCollection" uc
        LEFT JOIN LATERAL (
          SELECT "marketPrice" FROM "CardPrice" 
          WHERE "cardId" = uc."cardId" 
          ORDER BY "updatedAt" DESC 
          LIMIT 1
        ) cp ON true
        WHERE uc."userId" = ${ctx.user!.id} AND uc."isWishlist" = false
      `;
      
      const summary = currentValue[0] || {};
      const profit = (summary.market_value || 0) - (summary.cost_basis || 0);
      const profitPercent = summary.cost_basis > 0 ? (profit / summary.cost_basis) * 100 : 0;
      
      return {
        history: portfolioHistory,
        summary: {
          ...summary,
          profit,
          profitPercent,
        },
      };
    }),
  
  /**
   * Update prices manually (premium)
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
        message: `Price updates queued for ${jobs.length} cards`,
      };
    }),
});

// Helper functions
function getBucketKey(date: Date, interval: string): string {
  switch (interval) {
    case 'hour':
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    case 'week':
      const week = Math.floor(date.getDate() / 7);
      return `${date.getFullYear()}-${date.getMonth()}-W${week}`;
    case 'day':
    default:
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}