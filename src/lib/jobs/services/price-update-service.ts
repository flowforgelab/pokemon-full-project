import { JobQueue, PriceUpdateJobData, JobPriority } from '../types';
import { QueueManager } from '../queues';
import { prisma } from '@/lib/db/db';
import { redisCache } from '@/lib/cache/redis-cache';

export interface PriceUpdateOptions {
  type: 'full' | 'incremental' | 'specific' | 'popular';
  cardIds?: string[];
  force?: boolean;
  validateOnly?: boolean;
  limit?: number;
  priority?: JobPriority;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    cardId: string;
    cardName: string;
    issue: string;
  }>;
  warnings: Array<{
    cardId: string;
    cardName: string;
    issue: string;
  }>;
}

export class PriceUpdateService {
  /**
   * Schedule a price update job
   */
  async schedulePriceUpdate(options: PriceUpdateOptions): Promise<string> {
    const jobData: PriceUpdateJobData = {
      type: options.type,
      cardIds: options.cardIds,
      force: options.force,
      validateOnly: options.validateOnly,
      limit: options.limit,
    };

    const job = await QueueManager.addJob(
      JobQueue.PRICE_UPDATE,
      `price-update-${options.type}`,
      jobData,
      {
        priority: options.priority || JobPriority.NORMAL,
        scheduledBy: 'system',
        reason: `${options.type} price update`,
      }
    );

    return job.id!;
  }

  /**
   * Run price update immediately
   */
  async runPriceUpdate(jobId: string): Promise<void> {
    const job = await QueueManager.getJobStatus(JobQueue.PRICE_UPDATE, jobId);
    
    if (!job) {
      throw new Error(`Price update job ${jobId} not found`);
    }

    // Wait for job to complete
    // In a real implementation, you might want to use job events instead
    while (true) {
      const status = await QueueManager.getJobStatus(JobQueue.PRICE_UPDATE, jobId);
      
      if (!status) break;
      
      if (status.state === 'completed' || status.state === 'failed') {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Retry failed price updates
   */
  async retryFailedUpdates(jobId: string): Promise<void> {
    const job = await QueueManager.getJobStatus(JobQueue.PRICE_UPDATE, jobId);
    
    if (!job) {
      throw new Error(`Price update job ${jobId} not found`);
    }

    if (job.state !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    await QueueManager.retryJob(JobQueue.PRICE_UPDATE, jobId);
  }

  /**
   * Validate price data without updating
   */
  async validatePriceData(cardIds?: string[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Get cards to validate
      const cards = cardIds 
        ? await prisma.card.findMany({
            where: { id: { in: cardIds } },
            include: { prices: { orderBy: { updatedAt: 'desc' }, take: 1 } },
          })
        : await prisma.card.findMany({
            where: { tcgplayerProductId: { not: null } },
            include: { prices: { orderBy: { updatedAt: 'desc' }, take: 1 } },
            take: 1000, // Limit for validation
          });

      for (const card of cards) {
        const currentPrice = card.prices[0];

        // Check if card has TCGPlayer product ID
        if (!card.tcgplayerProductId) {
          result.warnings.push({
            cardId: card.id,
            cardName: card.name,
            issue: 'Missing TCGPlayer product ID',
          });
          continue;
        }

        // Check if card has price data
        if (!currentPrice) {
          result.warnings.push({
            cardId: card.id,
            cardName: card.name,
            issue: 'No price data available',
          });
          continue;
        }

        // Check price age
        const priceAge = Date.now() - currentPrice.updatedAt.getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (priceAge > sevenDays) {
          result.warnings.push({
            cardId: card.id,
            cardName: card.name,
            issue: `Price data is ${Math.floor(priceAge / (24 * 60 * 60 * 1000))} days old`,
          });
        }

        // Validate price values
        if (currentPrice.marketPrice <= 0) {
          result.errors.push({
            cardId: card.id,
            cardName: card.name,
            issue: 'Invalid market price (≤ 0)',
          });
          result.isValid = false;
        }

        if (currentPrice.lowPrice && currentPrice.highPrice && 
            currentPrice.lowPrice > currentPrice.highPrice) {
          result.errors.push({
            cardId: card.id,
            cardName: card.name,
            issue: 'Low price greater than high price',
          });
          result.isValid = false;
        }

        // Check for extreme prices
        if (currentPrice.marketPrice > 10000) {
          result.warnings.push({
            cardId: card.id,
            cardName: card.name,
            issue: `Extremely high price: $${currentPrice.marketPrice}`,
          });
        }
      }

      return result;

    } catch (error) {
      throw new Error(`Price validation failed: ${error}`);
    }
  }

  /**
   * Rollback price update to a previous state
   */
  async rollbackPriceUpdate(jobId: string, targetDate?: Date): Promise<void> {
    try {
      // Get job summary to identify affected cards
      const summaryKey = `job:summary:${jobId}`;
      const summaryData = await redisCache.get(summaryKey);
      
      if (!summaryData) {
        throw new Error(`No summary found for job ${jobId}`);
      }

      const summary = JSON.parse(summaryData);
      const affectedCardIds = summary.summary.significantChanges.map((c: any) => c.cardId);

      // If no target date, rollback to before the job
      const rollbackDate = targetDate || new Date(summary.metadata.startedAt);

      // Rollback prices for affected cards
      for (const cardId of affectedCardIds) {
        // Get the price history before the rollback date
        const previousPrice = await prisma.priceHistory.findFirst({
          where: {
            cardId,
            date: { lt: rollbackDate },
          },
          orderBy: { date: 'desc' },
        });

        if (previousPrice) {
          // Update current price to previous value
          await prisma.cardPrice.updateMany({
            where: { cardId },
            data: {
              marketPrice: previousPrice.marketPrice,
              lowPrice: previousPrice.lowPrice,
              midPrice: previousPrice.midPrice,
              highPrice: previousPrice.highPrice,
              updatedAt: new Date(),
            },
          });

          // Record rollback in history
          await prisma.priceHistory.create({
            data: {
              cardId,
              date: new Date(),
              marketPrice: previousPrice.marketPrice,
              lowPrice: previousPrice.lowPrice,
              midPrice: previousPrice.midPrice,
              highPrice: previousPrice.highPrice,
              source: 'rollback',
              metadata: { rollbackJobId: jobId, originalDate: previousPrice.date },
            },
          });
        }
      }

      // Clear caches
      await redisCache.deletePattern('price:*');
      await redisCache.deletePattern('collection:value:*');

      // Log rollback
      await QueueManager.addJob(
        JobQueue.AUDIT,
        'price-rollback',
        {
          jobId,
          targetDate,
          cardsAffected: affectedCardIds.length,
          rolledBackAt: new Date(),
        }
      );

    } catch (error) {
      throw new Error(`Price rollback failed: ${error}`);
    }
  }

  /**
   * Get price update history
   */
  async getPriceUpdateHistory(limit = 10): Promise<any[]> {
    const jobs = await QueueManager.getQueueStats(JobQueue.PRICE_UPDATE);
    
    // Get recent job summaries from Redis
    const summaries = [];
    const keys = await redisCache.keys('job:summary:*');
    
    for (const key of keys.slice(0, limit)) {
      const data = await redisCache.get(key);
      if (data) {
        summaries.push({
          jobId: key.replace('job:summary:', ''),
          ...JSON.parse(data),
        });
      }
    }

    return summaries.sort((a, b) => 
      new Date(b.metadata?.startedAt || 0).getTime() - 
      new Date(a.metadata?.startedAt || 0).getTime()
    );
  }

  /**
   * Get cards needing price updates
   */
  async getCardsNeedingUpdate(days = 7): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const cards = await prisma.card.findMany({
      where: {
        tcgplayerProductId: { not: null },
        OR: [
          { prices: { none: {} } },
          { prices: { some: { updatedAt: { lt: cutoffDate } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        setCode: true,
        number: true,
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: 100,
    });

    return cards.map(card => ({
      ...card,
      lastUpdated: card.prices[0]?.updatedAt || null,
      daysSinceUpdate: card.prices[0] 
        ? Math.floor((Date.now() - card.prices[0].updatedAt.getTime()) / (24 * 60 * 60 * 1000))
        : null,
    }));
  }

  /**
   * Force update specific cards
   */
  async forceUpdateCards(cardIds: string[]): Promise<string> {
    return await this.schedulePriceUpdate({
      type: 'specific',
      cardIds,
      force: true,
      priority: JobPriority.HIGH,
    });
  }

  /**
   * Update popular cards
   */
  async updatePopularCards(limit = 100): Promise<string> {
    return await this.schedulePriceUpdate({
      type: 'popular',
      limit,
      priority: JobPriority.NORMAL,
    });
  }
}

// Export singleton instance
export const priceUpdateService = new PriceUpdateService();