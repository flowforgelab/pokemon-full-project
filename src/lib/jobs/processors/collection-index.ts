import { Job } from 'bullmq';
import type { JobData, JobResult } from '@/lib/api/types';
import { CollectionSearchIndexer } from '@/lib/collection/search-indexer';
import { prisma } from '@/lib/db/prisma';

export async function processCollectionIndexJob(job: Job<JobData>): Promise<JobResult> {
  const { type, payload } = job.data;
  
  console.log(`Processing collection index job: ${type}`, payload);
  const startTime = Date.now();

  try {
    const indexer = new CollectionSearchIndexer();

    switch (type) {
      case 'INDEX_COLLECTIONS':
        await indexAllCollections(indexer, payload.scope);
        break;

      case 'INDEX_USER_COLLECTION':
        await indexUserCollection(indexer, payload.userId);
        break;

      case 'UPDATE_CARD_INDEX':
        await updateCardIndex(indexer, payload.userId, payload.cardIds);
        break;

      case 'CLEANUP_INDEXES':
        await cleanupOldIndexes();
        break;

      default:
        throw new Error(`Unknown collection index job type: ${type}`);
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `Collection index job ${type} completed`,
      data: {
        duration,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    console.error('Collection index job failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {
        duration: Date.now() - startTime,
        timestamp: new Date(),
      },
    };
  }
}

async function indexAllCollections(
  indexer: CollectionSearchIndexer,
  scope: 'all' | 'active'
): Promise<void> {
  // Update job progress
  await updateProgress(0, 'Starting collection indexing...');

  // Get users to index
  const userQuery: any = {
    collections: {
      some: {},
    },
  };

  if (scope === 'active') {
    // Only index users active in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    userQuery.lastActiveAt = { gte: thirtyDaysAgo };
  }

  const users = await prisma.user.findMany({
    where: userQuery,
    select: { id: true },
  });

  console.log(`Indexing collections for ${users.length} users (scope: ${scope})`);

  let processed = 0;
  const total = users.length;

  for (const user of users) {
    try {
      await indexer.indexUserCollection(user.id);
      processed++;

      // Update progress every 10 users
      if (processed % 10 === 0) {
        const progress = Math.round((processed / total) * 100);
        await updateProgress(progress, `Indexed ${processed}/${total} collections`);
      }
    } catch (error) {
      console.error(`Failed to index collection for user ${user.id}:`, error);
    }
  }

  await updateProgress(100, `Completed indexing ${processed} collections`);
}

async function indexUserCollection(
  indexer: CollectionSearchIndexer,
  userId: string
): Promise<void> {
  console.log(`Indexing collection for user ${userId}`);
  
  await indexer.indexUserCollection(userId);
  
  // Update user's last indexed timestamp
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastActiveAt: new Date(), // Update activity
    },
  });
}

async function updateCardIndex(
  indexer: CollectionSearchIndexer,
  userId: string,
  cardIds: string[]
): Promise<void> {
  console.log(`Updating index for ${cardIds.length} cards for user ${userId}`);
  
  await indexer.updateCardIndex(userId, cardIds);
}

async function cleanupOldIndexes(): Promise<void> {
  console.log('Cleaning up old search indexes...');
  
  const { cleanupOldIndexes } = await import('@/lib/collection/search-indexer');
  await cleanupOldIndexes();
}

// Helper to update job progress
async function updateProgress(percentage: number, message: string): Promise<void> {
  // This would be called from within the job context
  // For now, just log
  console.log(`[${percentage}%] ${message}`);
}