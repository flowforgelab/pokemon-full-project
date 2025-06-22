import { Job } from 'bullmq';
import { prisma } from '@/lib/db/prisma';
import type { JobData, JobResult } from '@/lib/api/types';

export async function processDataCleanupJob(job: Job<JobData>): Promise<JobResult> {
  const { olderThan = 90 } = job.data.payload;
  
  try {
    await job.updateProgress(5);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThan);

    console.log(`Cleaning up data older than ${cutoffDate.toISOString()}`);

    // 1. Clean up old price history
    const deletedPriceHistory = await prisma.priceHistory.deleteMany({
      where: {
        date: { lt: cutoffDate }
      }
    });
    
    await job.updateProgress(20);

    // 2. Clean up orphaned deck cards (decks that have been deleted)
    const orphanedDeckCards = await prisma.deckCard.deleteMany({
      where: {
        deck: { is: null }
      }
    });

    await job.updateProgress(30);

    // 3. Clean up expired trade offers
    const expiredTrades = await prisma.tradeOffer.deleteMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      }
    });

    await job.updateProgress(40);

    // 4. Clean up inactive price alerts
    const inactivePriceAlerts = await prisma.priceAlert.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: cutoffDate }
      }
    });

    await job.updateProgress(50);

    // 5. Clean up cards with no references (not in any set, deck, or collection)
    // This is a more complex operation that should be done carefully
    const orphanedCards = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Card" c
      WHERE NOT EXISTS (SELECT 1 FROM "DeckCard" WHERE "cardId" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "UserCollection" WHERE "cardId" = c.id)
        AND c."createdAt" < ${cutoffDate}
    `;

    await job.updateProgress(60);

    // 6. Optimize database (VACUUM ANALYZE)
    if (process.env.NODE_ENV === 'production') {
      try {
        await prisma.$executeRaw`VACUUM ANALYZE`;
      } catch (error) {
        console.error('Failed to vacuum database:', error);
      }
    }

    await job.updateProgress(80);

    // 7. Clean up old completed/failed jobs from BullMQ
    const queues = ['price-updates', 'set-imports', 'card-sync', 'data-cleanup', 'reports'];
    for (const queueName of queues) {
      try {
        const { Queue } = await import('bullmq');
        const queue = new Queue(queueName, {
          connection: {
            host: process.env.KV_REST_API_URL?.replace('https://', '').split('.')[0],
            port: 6379,
            password: process.env.KV_REST_API_TOKEN,
          }
        });
        
        await queue.clean(olderThan * 24 * 60 * 60 * 1000, 100, 'completed');
        await queue.clean(olderThan * 24 * 60 * 60 * 1000, 100, 'failed');
      } catch (error) {
        console.error(`Failed to clean queue ${queueName}:`, error);
      }
    }

    await job.updateProgress(100);

    return {
      success: true,
      message: 'Data cleanup completed',
      data: {
        deletedPriceHistory: deletedPriceHistory.count,
        orphanedDeckCards: orphanedDeckCards.count,
        expiredTrades: expiredTrades.count,
        inactivePriceAlerts: inactivePriceAlerts.count,
        orphanedCardsCount: Number(orphanedCards[0]?.count || 0),
        cutoffDate: cutoffDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('Data cleanup job failed:', error);
    return {
      success: false,
      message: 'Data cleanup job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}