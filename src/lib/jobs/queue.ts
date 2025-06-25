import type { Queue, Worker, Job, QueueEvents } from 'bullmq';
import type { JobData, JobResult } from '@/lib/api/types';

// Check if we're in a build environment
const IS_BUILD = process.env.NODE_ENV === 'production' && !process.env.KV_REST_API_URL;

// Mock queue implementation for build time
class MockQueue {
  constructor(public name: string) {}
  async add() { return { id: 'mock' } as any; }
  async addBulk() { return []; }
  async getWaitingCount() { return 0; }
  async getActiveCount() { return 0; }
  async getCompletedCount() { return 0; }
  async getFailedCount() { return 0; }
  async getDelayedCount() { return 0; }
  async isPaused() { return false; }
  async pause() {}
  async resume() {}
  async clean() {}
  async obliterate() {}
}

class MockQueueEvents {
  constructor(public name: string) {}
  on() {}
  off() {}
  once() {}
}

// Lazy load BullMQ only when needed
let BullMQ: any = null;
const getBullMQ = async () => {
  if (!BullMQ && !IS_BUILD) {
    BullMQ = await import('bullmq');
  }
  return BullMQ;
};

// Create queue instances - will be either mock or real based on environment
const createQueue = async (name: string): Promise<Queue> => {
  if (IS_BUILD) {
    return new MockQueue(name) as any;
  }
  
  const { Queue } = await getBullMQ();
  const connection = {
    host: 'localhost',
    port: 6379,
    password: process.env.KV_REST_API_TOKEN,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  };
  
  return new Queue(name, { connection });
};

const createQueueEvents = async (name: string): Promise<QueueEvents> => {
  if (IS_BUILD) {
    return new MockQueueEvents(name) as any;
  }
  
  const { QueueEvents } = await getBullMQ();
  const connection = {
    host: 'localhost',
    port: 6379,
    password: process.env.KV_REST_API_TOKEN,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  };
  
  return new QueueEvents(name, { connection });
};

// Export queue getters that return promises
export const priceUpdateQueue = IS_BUILD ? Promise.resolve(new MockQueue('price-updates') as any) : createQueue('price-updates');
export const setImportQueue = IS_BUILD ? Promise.resolve(new MockQueue('set-imports') as any) : createQueue('set-imports');
export const cardSyncQueue = IS_BUILD ? Promise.resolve(new MockQueue('card-sync') as any) : createQueue('card-sync');
export const dataCleanupQueue = IS_BUILD ? Promise.resolve(new MockQueue('data-cleanup') as any) : createQueue('data-cleanup');
export const reportQueue = IS_BUILD ? Promise.resolve(new MockQueue('reports') as any) : createQueue('reports');
export const collectionIndexQueue = IS_BUILD ? Promise.resolve(new MockQueue('collection-index') as any) : createQueue('collection-index');
export const pokemonTCGQueue = IS_BUILD ? Promise.resolve(new MockQueue('pokemon-tcg') as any) : createQueue('pokemon-tcg');

// Export queue events
export const priceUpdateEvents = IS_BUILD ? Promise.resolve(new MockQueueEvents('price-updates') as any) : createQueueEvents('price-updates');
export const setImportEvents = IS_BUILD ? Promise.resolve(new MockQueueEvents('set-imports') as any) : createQueueEvents('set-imports');
export const cardSyncEvents = IS_BUILD ? Promise.resolve(new MockQueueEvents('card-sync') as any) : createQueueEvents('card-sync');

// Job scheduling utilities
export async function scheduleRecurringJobs(): Promise<void> {
  if (IS_BUILD) {
    console.log('Skipping job scheduling in build environment');
    return;
  }

  console.log('Scheduling recurring jobs...');

  // Get queue instances
  const [
    priceQueue,
    syncQueue,
    cleanupQueue,
    reportQ,
    indexQueue
  ] = await Promise.all([
    priceUpdateQueue,
    cardSyncQueue,
    dataCleanupQueue,
    reportQueue,
    collectionIndexQueue
  ]);

  // Weekly price updates - Every Sunday at 2 AM
  await priceQueue.add(
    'weekly-price-update',
    { type: 'UPDATE_PRICES', payload: { scope: 'all' } },
    {
      repeat: {
        pattern: '0 2 * * 0', // Cron pattern
      },
      removeOnComplete: { count: 10 }, // Keep last 10 completed jobs
      removeOnFail: { count: 20 }, // Keep last 20 failed jobs
    }
  );

  // Daily card sync - Every day at 3 AM
  await syncQueue.add(
    'daily-card-sync',
    { type: 'SYNC_CARDS', payload: { scope: 'recent' } },
    {
      repeat: {
        pattern: '0 3 * * *',
      },
      removeOnComplete: { count: 7 },
      removeOnFail: { count: 14 },
    }
  );

  // Monthly data cleanup - First day of month at 4 AM
  await cleanupQueue.add(
    'monthly-cleanup',
    { type: 'CLEANUP_DATA', payload: { olderThan: 90 } },
    {
      repeat: {
        pattern: '0 4 1 * *',
      },
      removeOnComplete: { count: 3 },
      removeOnFail: { count: 6 },
    }
  );

  // Weekly usage report - Every Monday at 9 AM
  await reportQ.add(
    'weekly-usage-report',
    { type: 'GENERATE_REPORT', payload: { reportType: 'usage', period: 'week' } },
    {
      repeat: {
        pattern: '0 9 * * 1',
      },
      removeOnComplete: { count: 4 },
      removeOnFail: { count: 8 },
    }
  );

  // Daily collection index update - Every day at 1 AM
  await indexQueue.add(
    'daily-index-update',
    { type: 'INDEX_COLLECTIONS', payload: { scope: 'all' } },
    {
      repeat: {
        pattern: '0 1 * * *',
      },
      removeOnComplete: { count: 7 },
      removeOnFail: { count: 14 },
    }
  );

  console.log('Recurring jobs scheduled successfully');
}

// Job processors configuration
export interface JobProcessor {
  name: string;
  process: (job: Job<JobData>) => Promise<JobResult>;
  concurrency?: number;
  options?: {
    maxStalledCount?: number;
    stalledInterval?: number;
  };
}

// Helper function to create a worker
export async function createWorker(
  queueName: string,
  processor: (job: Job<JobData>) => Promise<JobResult>,
  concurrency = 1
): Promise<Worker | null> {
  if (IS_BUILD) {
    console.log(`Skipping worker creation for ${queueName} in build environment`);
    return null;
  }

  const { Worker } = await getBullMQ();
  const connection = {
    host: 'localhost',
    port: 6379,
    password: process.env.KV_REST_API_TOKEN,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  };

  return new Worker(
    queueName,
    async (job: Job<JobData>) => {
      console.log(`Processing job ${job.id} in queue ${queueName}`);
      const startTime = Date.now();
      
      try {
        const result = await processor(job);
        const duration = Date.now() - startTime;
        
        console.log(`Job ${job.id} completed in ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Job ${job.id} failed after ${duration}ms:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    }
  );
}

// Queue management utilities
export async function getQueueStats(queue: Queue): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}> {
  const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: isPaused,
  };
}

export async function getAllQueuesStats(): Promise<Record<string, any>> {
  if (IS_BUILD) {
    return {};
  }

  const [
    priceQueue,
    setQueue,
    syncQueue,
    cleanupQueue,
    reportQ,
    indexQueue
  ] = await Promise.all([
    priceUpdateQueue,
    setImportQueue,
    cardSyncQueue,
    dataCleanupQueue,
    reportQueue,
    collectionIndexQueue
  ]);

  const queues = {
    priceUpdates: priceQueue,
    setImports: setQueue,
    cardSync: syncQueue,
    dataCleanup: cleanupQueue,
    reports: reportQ,
    collectionIndex: indexQueue,
  };

  const stats: Record<string, any> = {};

  for (const [name, queue] of Object.entries(queues)) {
    stats[name] = await getQueueStats(queue);
  }

  return stats;
}

// Retry configuration for different job types
export const retryConfigs = {
  priceUpdate: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 5000, // 5 seconds base delay
    },
  },
  setImport: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 10000, // 10 seconds base delay
    },
  },
  cardSync: {
    attempts: 4,
    backoff: {
      type: 'exponential' as const,
      delay: 3000, // 3 seconds base delay
    },
  },
  dataCleanup: {
    attempts: 2,
    backoff: {
      type: 'fixed' as const,
      delay: 60000, // 1 minute delay
    },
  },
};

// Priority levels for jobs
export enum JobPriority {
  LOW = 10,
  NORMAL = 0,
  HIGH = -10,
  CRITICAL = -20,
}

// Add a job with priority
export async function addPriorityJob(
  queue: Queue,
  name: string,
  data: JobData,
  priority: JobPriority = JobPriority.NORMAL
): Promise<Job> {
  return queue.add(name, data, {
    priority,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

// Bulk job operations
export async function addBulkJobs(
  queue: Queue,
  jobs: Array<{ name: string; data: JobData; opts?: any }>
): Promise<Job[]> {
  return queue.addBulk(jobs);
}

// Clear queue utilities
export async function clearQueue(queue: Queue, status?: 'completed' | 'failed' | 'delayed' | 'wait'): Promise<void> {
  if (status) {
    await queue.clean(0, 1000, status);
  } else {
    await queue.obliterate({ force: true });
  }
}

// Pause and resume utilities
export async function pauseQueue(queue: Queue): Promise<void> {
  await queue.pause();
  console.log(`Queue ${queue.name} paused`);
}

export async function resumeQueue(queue: Queue): Promise<void> {
  await queue.resume();
  console.log(`Queue ${queue.name} resumed`);
}

// Job event listeners setup
export function setupJobEventListeners(queueEvents: QueueEvents, queueName: string): void {
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[${queueName}] Job ${jobId} completed with result:`, returnvalue);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[${queueName}] Job ${jobId} failed:`, failedReason);
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    console.log(`[${queueName}] Job ${jobId} progress:`, data);
  });

  queueEvents.on('stalled', ({ jobId }) => {
    console.warn(`[${queueName}] Job ${jobId} stalled`);
  });
}

// Initialize event listeners only if Redis is configured and not in build
if (!IS_BUILD && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  // Set up event listeners asynchronously
  (async () => {
    try {
      const [priceEvents, setEvents, syncEvents] = await Promise.all([
        priceUpdateEvents,
        setImportEvents,
        cardSyncEvents
      ]);
      
      setupJobEventListeners(priceEvents, 'price-updates');
      setupJobEventListeners(setEvents, 'set-imports');
      setupJobEventListeners(syncEvents, 'card-sync');
    } catch (error) {
      console.error('Failed to set up job event listeners:', error);
    }
  })();
}