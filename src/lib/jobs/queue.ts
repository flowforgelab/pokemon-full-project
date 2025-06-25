import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { redis } from '@/server/db/redis';
import type { JobData, JobResult } from '@/lib/api/types';

// Redis connection configuration for BullMQ
const createConnection = () => {
  // During build time or when KV is not configured, return a dummy connection
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn('Redis configuration missing. Using dummy connection for build.');
    return {
      host: 'localhost',
      port: 6379,
      password: 'dummy',
      // Add these options to prevent connection attempts during build
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    };
  }

  // For Upstash Redis, we should use the REST API, not direct Redis connection
  // BullMQ doesn't support REST APIs directly, so we need to use localhost with SSH tunnel
  // or use a different queue solution. For now, return a non-connecting config.
  return {
    host: 'localhost',
    port: 6379,
    password: process.env.KV_REST_API_TOKEN,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  };
};

const connection = createConnection();

// Lazy initialization of queues to prevent connection attempts during build
let _priceUpdateQueue: Queue | null = null;
let _setImportQueue: Queue | null = null;
let _cardSyncQueue: Queue | null = null;
let _dataCleanupQueue: Queue | null = null;
let _reportQueue: Queue | null = null;
let _collectionIndexQueue: Queue | null = null;
let _pokemonTCGQueue: Queue | null = null;

// Lazy getters for queues
export const priceUpdateQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_priceUpdateQueue && process.env.KV_REST_API_URL) {
      _priceUpdateQueue = new Queue('price-updates', { connection });
    }
    return _priceUpdateQueue ? (_priceUpdateQueue as any)[prop] : () => Promise.resolve();
  }
});

export const setImportQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_setImportQueue && process.env.KV_REST_API_URL) {
      _setImportQueue = new Queue('set-imports', { connection });
    }
    return _setImportQueue ? (_setImportQueue as any)[prop] : () => Promise.resolve();
  }
});

export const cardSyncQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_cardSyncQueue && process.env.KV_REST_API_URL) {
      _cardSyncQueue = new Queue('card-sync', { connection });
    }
    return _cardSyncQueue ? (_cardSyncQueue as any)[prop] : () => Promise.resolve();
  }
});

export const dataCleanupQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_dataCleanupQueue && process.env.KV_REST_API_URL) {
      _dataCleanupQueue = new Queue('data-cleanup', { connection });
    }
    return _dataCleanupQueue ? (_dataCleanupQueue as any)[prop] : () => Promise.resolve();
  }
});

export const reportQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_reportQueue && process.env.KV_REST_API_URL) {
      _reportQueue = new Queue('reports', { connection });
    }
    return _reportQueue ? (_reportQueue as any)[prop] : () => Promise.resolve();
  }
});

export const collectionIndexQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_collectionIndexQueue && process.env.KV_REST_API_URL) {
      _collectionIndexQueue = new Queue('collection-index', { connection });
    }
    return _collectionIndexQueue ? (_collectionIndexQueue as any)[prop] : () => Promise.resolve();
  }
});

// Main Pokemon TCG queue for general jobs
export const pokemonTCGQueue = new Proxy({} as Queue, {
  get(target, prop) {
    if (!_pokemonTCGQueue && process.env.KV_REST_API_URL) {
      _pokemonTCGQueue = new Queue('pokemon-tcg', { connection });
    }
    return _pokemonTCGQueue ? (_pokemonTCGQueue as any)[prop] : () => Promise.resolve();
  }
});

// Queue events for monitoring - also lazy initialized
let _priceUpdateEvents: QueueEvents | null = null;
let _setImportEvents: QueueEvents | null = null;
let _cardSyncEvents: QueueEvents | null = null;

export const priceUpdateEvents = new Proxy({} as QueueEvents, {
  get(target, prop) {
    if (!_priceUpdateEvents && process.env.KV_REST_API_URL) {
      _priceUpdateEvents = new QueueEvents('price-updates', { connection });
    }
    return _priceUpdateEvents ? (_priceUpdateEvents as any)[prop] : () => {};
  }
});

export const setImportEvents = new Proxy({} as QueueEvents, {
  get(target, prop) {
    if (!_setImportEvents && process.env.KV_REST_API_URL) {
      _setImportEvents = new QueueEvents('set-imports', { connection });
    }
    return _setImportEvents ? (_setImportEvents as any)[prop] : () => {};
  }
});

export const cardSyncEvents = new Proxy({} as QueueEvents, {
  get(target, prop) {
    if (!_cardSyncEvents && process.env.KV_REST_API_URL) {
      _cardSyncEvents = new QueueEvents('card-sync', { connection });
    }
    return _cardSyncEvents ? (_cardSyncEvents as any)[prop] : () => {};
  }
});

// Job scheduling utilities
export async function scheduleRecurringJobs(): Promise<void> {
  console.log('Scheduling recurring jobs...');

  // Weekly price updates - Every Sunday at 2 AM
  await priceUpdateQueue.add(
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
  await cardSyncQueue.add(
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
  await dataCleanupQueue.add(
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
  await reportQueue.add(
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
  await collectionIndexQueue.add(
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
export function createWorker(
  queueName: string,
  processor: (job: Job<JobData>) => Promise<JobResult>,
  concurrency = 1
): Worker {
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
  const queues = {
    priceUpdates: priceUpdateQueue,
    setImports: setImportQueue,
    cardSync: cardSyncQueue,
    dataCleanup: dataCleanupQueue,
    reports: reportQueue,
    collectionIndex: collectionIndexQueue,
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

// Initialize event listeners only if Redis is configured
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  setupJobEventListeners(priceUpdateEvents, 'price-updates');
  setupJobEventListeners(setImportEvents, 'set-imports');
  setupJobEventListeners(cardSyncEvents, 'card-sync');
}