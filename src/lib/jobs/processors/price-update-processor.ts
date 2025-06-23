import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/db/db';
// TCGPlayer client removed - pricing integration disabled
import { redisCache } from '@/lib/cache/redis-cache';
import { 
  PriceUpdateJobData, 
  PriceUpdateResult, 
  PriceUpdateError,
  PriceUpdateSummary,
  JobQueue 
} from '../types';

const BATCH_SIZE = 50;
const PRICE_CHANGE_THRESHOLD = 0.1; // 10% change is considered significant
const ANOMALY_THRESHOLD = 10; // 10x price change is considered an anomaly

export class PriceUpdateProcessor {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      JobQueue.PRICE_UPDATE,
      this.process.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 2, // Process 2 price update jobs concurrently
      }
    );

    this.setupEventHandlers();
  }

  private async process(job: Job<PriceUpdateJobData>): Promise<PriceUpdateResult> {
    const startTime = Date.now();
    
    // TCGPlayer integration has been removed
    await job.log('Price updates are disabled - TCGPlayer integration has been removed');
    
    return {
      cardsProcessed: 0,
      cardsUpdated: 0,
      pricesCreated: 0,
      pricesUpdated: 0,
      errors: [{
        cardId: 'system',
        cardName: 'System',
        error: 'TCGPlayer integration has been removed. Price updates are disabled.',
        timestamp: new Date(),
      }],
      summary: {
        cardsUpdated: 0,
        averagePriceChange: 0,
        significantChanges: [],
        apiCallsUsed: 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
    
    // Original implementation disabled
    /*
    const errors: PriceUpdateError[] = [];
    const significantChanges: PriceUpdateSummary['significantChanges'] = [];
    
    try {
      await job.log(`Starting price update job: ${job.data.type}`);
      
      // Get cards to update based on job type
      const cards = await this.getCardsToUpdate(job.data);
      const totalCards = cards.length;
      
      await job.log(`Found ${totalCards} cards to update`);
      await job.updateProgress(0);

      let cardsProcessed = 0;
      let cardsUpdated = 0;
      let pricesCreated = 0;
      let pricesUpdated = 0;
      let apiCallsUsed = 0;

      // Process cards in batches
      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        const batch = cards.slice(i, i + BATCH_SIZE);
        
        try {
          const batchResult = await this.processBatch(batch, job.data);
          
          cardsProcessed += batch.length;
          cardsUpdated += batchResult.updated;
          pricesCreated += batchResult.created;
          pricesUpdated += batchResult.updated;
          apiCallsUsed += batchResult.apiCalls;
          
          // Track significant changes
          significantChanges.push(...batchResult.significantChanges);
          
          // Handle errors
          if (batchResult.errors.length > 0) {
            errors.push(...batchResult.errors);
          }
          
          // Update progress
          const progress = Math.floor((cardsProcessed / totalCards) * 100);
          await job.updateProgress(progress);
          await job.log(`Processed ${cardsProcessed}/${totalCards} cards`);
          
          // Rate limit between batches
          await this.delay(1000); // 1 second delay between batches
          
        } catch (error) {
          await job.log(`Error processing batch: ${error}`);
          errors.push(...batch.map(card => ({
            cardId: card.id,
            cardName: card.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          })));
        }
      }

      // Calculate average price change
      const averagePriceChange = significantChanges.length > 0
        ? significantChanges.reduce((sum, change) => sum + change.changePercent, 0) / significantChanges.length
        : 0;

      // Clear price caches
      await this.clearPriceCaches();

      const summary: PriceUpdateSummary = {
        cardsUpdated,
        averagePriceChange,
        significantChanges: significantChanges.slice(0, 20), // Top 20 changes
        apiCallsUsed,
        processingTimeMs: Date.now() - startTime,
      };

      const result: PriceUpdateResult = {
        cardsProcessed,
        cardsUpdated,
        pricesCreated,
        pricesUpdated,
        errors,
        summary,
      };

      await job.log(`Price update completed: ${cardsUpdated} cards updated`);
      
      // Store summary for reporting
      await this.storeSummary(job.id!, result);
      
      return result;
      
    } catch (error) {
      await job.log(`Fatal error in price update: ${error}`);
      throw error;
    }
    */
  }

  private async getCardsToUpdate(data: PriceUpdateJobData) {
    switch (data.type) {
      case 'full':
        return await prisma.card.findMany({
          where: { tcgplayerProductId: { not: null } },
          select: {
            id: true,
            name: true,
            setCode: true,
            number: true,
            tcgplayerProductId: true,
          },
        });
        
      case 'incremental':
        // Get cards that haven't been updated in the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return await prisma.card.findMany({
          where: {
            tcgplayerProductId: { not: null },
            OR: [
              { prices: { none: {} } },
              { prices: { some: { updatedAt: { lt: sevenDaysAgo } } } },
            ],
          },
          select: {
            id: true,
            name: true,
            setCode: true,
            number: true,
            tcgplayerProductId: true,
          },
        });
        
      case 'specific':
        if (!data.cardIds || data.cardIds.length === 0) {
          throw new Error('No card IDs provided for specific update');
        }
        
        return await prisma.card.findMany({
          where: {
            id: { in: data.cardIds },
            tcgplayerProductId: { not: null },
          },
          select: {
            id: true,
            name: true,
            setCode: true,
            number: true,
            tcgplayerProductId: true,
          },
        });
        
      case 'popular':
        // Get popular cards based on deck usage
        const popularCards = await prisma.deckCard.groupBy({
          by: ['cardId'],
          _count: { deckId: true },
          orderBy: { _count: { deckId: 'desc' } },
          take: data.limit || 100,
        });
        
        const cardIds = popularCards.map(pc => pc.cardId);
        
        return await prisma.card.findMany({
          where: {
            id: { in: cardIds },
            tcgplayerProductId: { not: null },
          },
          select: {
            id: true,
            name: true,
            setCode: true,
            number: true,
            tcgplayerProductId: true,
          },
        });
        
      default:
        throw new Error(`Unknown update type: ${data.type}`);
    }
  }

  private async processBatch(cards: any[], data: PriceUpdateJobData) {
    const productIds = cards.map(c => c.tcgplayerProductId).filter(Boolean);
    const errors: PriceUpdateError[] = [];
    const significantChanges: any[] = [];
    let created = 0;
    let updated = 0;

    try {
      // TCGPlayer integration removed - return empty prices
      const prices: any[] = [];
      
      // Validate prices if requested
      if (data.validateOnly) {
        return this.validatePrices(cards, prices);
      }

      // Process each card's price
      for (const card of cards) {
        // TCGPlayer integration removed - skip price updates
        const priceData = null;
        
        if (!priceData || !priceData.marketPrice) {
          errors.push({
            cardId: card.id,
            cardName: card.name,
            error: 'No price data available',
            timestamp: new Date(),
          });
          continue;
        }

        try {
          // Get current price
          const currentPrice = await prisma.cardPrice.findFirst({
            where: { cardId: card.id },
            orderBy: { updatedAt: 'desc' },
          });

          // Check for anomalies
          if (currentPrice && this.isAnomaly(currentPrice.marketPrice, priceData.marketPrice)) {
            errors.push({
              cardId: card.id,
              cardName: card.name,
              error: `Price anomaly detected: ${currentPrice.marketPrice} -> ${priceData.marketPrice}`,
              timestamp: new Date(),
            });
            continue;
          }

          // Update or create price
          if (currentPrice) {
            // Check if price has changed significantly
            const changePercent = this.calculatePriceChange(
              currentPrice.marketPrice,
              priceData.marketPrice
            );

            if (Math.abs(changePercent) >= PRICE_CHANGE_THRESHOLD) {
              // Update existing price
              await prisma.cardPrice.update({
                where: { id: currentPrice.id },
                data: {
                  marketPrice: priceData.marketPrice,
                  lowPrice: priceData.lowPrice,
                  midPrice: priceData.midPrice,
                  highPrice: priceData.highPrice,
                  directLowPrice: priceData.directLowPrice,
                },
              });

              // Record price history
              await prisma.priceHistory.create({
                data: {
                  cardId: card.id,
                  date: new Date(),
                  marketPrice: priceData.marketPrice,
                  lowPrice: priceData.lowPrice,
                  midPrice: priceData.midPrice,
                  highPrice: priceData.highPrice,
                  source: 'tcgplayer',
                },
              });

              updated++;

              // Track significant change
              if (Math.abs(changePercent) >= 0.2) { // 20% change
                significantChanges.push({
                  cardId: card.id,
                  cardName: card.name,
                  oldPrice: currentPrice.marketPrice,
                  newPrice: priceData.marketPrice,
                  changePercent,
                });
              }
            }
          } else {
            // Create new price record
            await prisma.cardPrice.create({
              data: {
                cardId: card.id,
                marketPrice: priceData.marketPrice,
                lowPrice: priceData.lowPrice,
                midPrice: priceData.midPrice,
                highPrice: priceData.highPrice,
                directLowPrice: priceData.directLowPrice,
                source: 'tcgplayer',
              },
            });

            // Record initial price history
            await prisma.priceHistory.create({
              data: {
                cardId: card.id,
                date: new Date(),
                marketPrice: priceData.marketPrice,
                lowPrice: priceData.lowPrice,
                midPrice: priceData.midPrice,
                highPrice: priceData.highPrice,
                source: 'tcgplayer',
              },
            });

            created++;
          }

          // Trigger price alerts if applicable
          await this.checkPriceAlerts(card.id, priceData.marketPrice);

        } catch (error) {
          errors.push({
            cardId: card.id,
            cardName: card.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }

      return {
        created,
        updated,
        errors,
        significantChanges,
        apiCalls: 1, // One API call per batch
      };

    } catch (error) {
      // If the entire batch fails, return errors for all cards
      return {
        created: 0,
        updated: 0,
        errors: cards.map(card => ({
          cardId: card.id,
          cardName: card.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        })),
        significantChanges: [],
        apiCalls: 1,
      };
    }
  }

  private isAnomaly(oldPrice: number, newPrice: number): boolean {
    return newPrice > oldPrice * ANOMALY_THRESHOLD || newPrice < oldPrice / ANOMALY_THRESHOLD;
  }

  private calculatePriceChange(oldPrice: number, newPrice: number): number {
    if (oldPrice === 0) return 0;
    return (newPrice - oldPrice) / oldPrice;
  }

  private async validatePrices(cards: any[], prices: any[]) {
    const errors: PriceUpdateError[] = [];
    
    for (const card of cards) {
      const priceData = prices.find(p => p.productId === card.tcgplayerProductId);
      
      if (!priceData) {
        errors.push({
          cardId: card.id,
          cardName: card.name,
          error: 'No price data found',
          timestamp: new Date(),
        });
        continue;
      }

      // Validate price data
      if (!priceData.marketPrice || priceData.marketPrice <= 0) {
        errors.push({
          cardId: card.id,
          cardName: card.name,
          error: 'Invalid market price',
          timestamp: new Date(),
        });
      }

      if (priceData.lowPrice && priceData.highPrice && priceData.lowPrice > priceData.highPrice) {
        errors.push({
          cardId: card.id,
          cardName: card.name,
          error: 'Low price greater than high price',
          timestamp: new Date(),
        });
      }
    }

    return {
      created: 0,
      updated: 0,
      errors,
      significantChanges: [],
      apiCalls: 1,
    };
  }

  private async checkPriceAlerts(cardId: string, newPrice: number) {
    try {
      const alerts = await prisma.priceAlert.findMany({
        where: {
          cardId,
          active: true,
          OR: [
            { targetPrice: { lte: newPrice }, alertType: 'ABOVE' },
            { targetPrice: { gte: newPrice }, alertType: 'BELOW' },
          ],
        },
        include: { user: true, card: true },
      });

      for (const alert of alerts) {
        // Trigger alert notification
        await this.sendPriceAlert(alert, newPrice);
        
        // Deactivate alert
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { active: false, triggeredAt: new Date() },
        });
      }
    } catch (error) {
      console.error('Error checking price alerts:', error);
    }
  }

  private async sendPriceAlert(alert: any, currentPrice: number) {
    // TODO: Implement notification sending (email, push notification, etc.)
    console.log(`Price alert triggered for user ${alert.userId}: ${alert.card.name} is now $${currentPrice}`);
  }

  private async clearPriceCaches() {
    try {
      // Clear price-related caches
      await redisCache.deletePattern('price:*');
      await redisCache.deletePattern('collection:value:*');
    } catch (error) {
      console.error('Error clearing price caches:', error);
    }
  }

  private async storeSummary(jobId: string, result: PriceUpdateResult) {
    try {
      await redisCache.set(
        `job:summary:${jobId}`,
        JSON.stringify(result),
        3600 * 24 * 7 // Keep for 7 days
      );
    } catch (error) {
      console.error('Error storing job summary:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Price update job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Price update job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Price update worker error:', err);
    });
  }

  async shutdown() {
    await this.worker.close();
  }
}

// Create and export processor instance
export const priceUpdateProcessor = new PriceUpdateProcessor();