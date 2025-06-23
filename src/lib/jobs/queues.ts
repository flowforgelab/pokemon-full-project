import { Queue, Worker, QueueEvents, ConnectionOptions } from 'bullmq';
import { createClient } from 'redis';
import { JobQueue, JobPriority, JobMetadata } from './types';

// Redis connection configuration
const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
};

// Create queues for different job types
export const queues: Record<JobQueue, Queue> = {
  [JobQueue.PRICE_UPDATE]: new Queue(JobQueue.PRICE_UPDATE, { connection: redisConnection }),
  [JobQueue.SET_IMPORT]: new Queue(JobQueue.SET_IMPORT, { connection: redisConnection }),
  [JobQueue.DATA_VALIDATION]: new Queue(JobQueue.DATA_VALIDATION, { connection: redisConnection }),
  [JobQueue.DATA_CLEANUP]: new Queue(JobQueue.DATA_CLEANUP, { connection: redisConnection }),
  [JobQueue.FORMAT_ROTATION]: new Queue(JobQueue.FORMAT_ROTATION, { connection: redisConnection }),
  [JobQueue.BACKUP]: new Queue(JobQueue.BACKUP, { connection: redisConnection }),
  [JobQueue.AUDIT]: new Queue(JobQueue.AUDIT, { connection: redisConnection }),
  [JobQueue.MAINTENANCE]: new Queue(JobQueue.MAINTENANCE, { connection: redisConnection }),
};

// Queue event listeners for monitoring
export const queueEvents: Record<JobQueue, QueueEvents> = Object.entries(queues).reduce(
  (acc, [key, queue]) => {
    acc[key as JobQueue] = new QueueEvents(queue.name, { connection: redisConnection });
    return acc;
  },
  {} as Record<JobQueue, QueueEvents>
);

// Default job options
export const defaultJobOptions = {
  removeOnComplete: {
    age: 3600, // 1 hour
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    age: 86400, // 24 hours
    count: 500, // Keep last 500 failed jobs
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5 seconds
  },
};

// Queue management utilities
export class QueueManager {
  /**
   * Add a job to the specified queue
   */
  static async addJob<T>(
    queueName: JobQueue,
    name: string,
    data: T,
    metadata?: Partial<JobMetadata>
  ) {
    const queue = queues[queueName];
    const jobData = {
      ...data,
      _metadata: {
        scheduledBy: 'system',
        scheduledAt: new Date(),
        priority: JobPriority.NORMAL,
        ...metadata,
      },
    };

    const options = {
      ...defaultJobOptions,
      priority: metadata?.priority || JobPriority.NORMAL,
      delay: metadata?.delay,
    };

    return await queue.add(name, jobData, options);
  }

  /**
   * Schedule a recurring job
   */
  static async scheduleJob<T>(
    queueName: JobQueue,
    name: string,
    data: T,
    cron: string,
    metadata?: Partial<JobMetadata>
  ) {
    const queue = queues[queueName];
    const jobData = {
      ...data,
      _metadata: {
        scheduledBy: 'system',
        scheduledAt: new Date(),
        priority: JobPriority.NORMAL,
        recurring: true,
        ...metadata,
      },
    };

    const options = {
      ...defaultJobOptions,
      repeat: {
        pattern: cron,
        tz: process.env.TZ || 'UTC',
      },
      priority: metadata?.priority || JobPriority.NORMAL,
    };

    return await queue.add(name, jobData, options);
  }

  /**
   * Get job status and progress
   */
  static async getJobStatus(queueName: JobQueue, jobId: string) {
    const queue = queues[queueName];
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const logs = await queue.getJobLogs(jobId);

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      logs: logs.logs,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp,
    };
  }

  /**
   * Cancel a job
   */
  static async cancelJob(queueName: JobQueue, jobId: string, reason?: string) {
    const queue = queues[queueName];
    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.remove();
    
    // Log cancellation
    await this.addJob(
      JobQueue.AUDIT,
      'job-cancelled',
      {
        queueName,
        jobId,
        reason,
        cancelledAt: new Date(),
      }
    );

    return true;
  }

  /**
   * Retry a failed job
   */
  static async retryJob(queueName: JobQueue, jobId: string) {
    const queue = queues[queueName];
    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state (current: ${state})`);
    }

    await job.retry();
    return true;
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(queueName: JobQueue) {
    const queue = queues[queueName];
    
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      status: paused ? 'paused' : 'active',
    };
  }

  /**
   * Get all queue statistics
   */
  static async getAllQueueStats() {
    const stats = await Promise.all(
      Object.values(JobQueue).map(queueName => this.getQueueStats(queueName))
    );

    return stats.reduce((acc, stat) => {
      acc[stat.name] = stat;
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Pause a queue
   */
  static async pauseQueue(queueName: JobQueue) {
    const queue = queues[queueName];
    await queue.pause();
    
    await this.addJob(
      JobQueue.AUDIT,
      'queue-paused',
      {
        queueName,
        pausedAt: new Date(),
      }
    );
  }

  /**
   * Resume a queue
   */
  static async resumeQueue(queueName: JobQueue) {
    const queue = queues[queueName];
    await queue.resume();
    
    await this.addJob(
      JobQueue.AUDIT,
      'queue-resumed',
      {
        queueName,
        resumedAt: new Date(),
      }
    );
  }

  /**
   * Clean completed/failed jobs
   */
  static async cleanQueue(
    queueName: JobQueue,
    grace: number = 0,
    limit: number = 0,
    status: 'completed' | 'failed' = 'completed'
  ) {
    const queue = queues[queueName];
    const jobs = await queue.clean(grace, limit, status);
    
    await this.addJob(
      JobQueue.AUDIT,
      'queue-cleaned',
      {
        queueName,
        status,
        jobsCleaned: jobs.length,
        cleanedAt: new Date(),
      }
    );

    return jobs.length;
  }

  /**
   * Drain a queue (remove all jobs)
   */
  static async drainQueue(queueName: JobQueue, delayed = false) {
    const queue = queues[queueName];
    await queue.drain(delayed);
    
    await this.addJob(
      JobQueue.AUDIT,
      'queue-drained',
      {
        queueName,
        includeDelayed: delayed,
        drainedAt: new Date(),
      }
    );
  }
}

// Health check for Redis connection
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = createClient(redisConnection);
    await client.connect();
    await client.ping();
    await client.disconnect();
    return true;
  } catch (error) {
    console.error('Redis connection check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function shutdownQueues() {
  console.log('Shutting down job queues...');
  
  try {
    // Close all workers
    await Promise.all(
      Object.values(queues).map(queue => queue.close())
    );
    
    // Close all event listeners
    await Promise.all(
      Object.values(queueEvents).map(events => events.close())
    );
    
    console.log('Job queues shut down successfully');
  } catch (error) {
    console.error('Error shutting down queues:', error);
    throw error;
  }
}

// Initialize shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGTERM', shutdownQueues);
  process.on('SIGINT', shutdownQueues);
}