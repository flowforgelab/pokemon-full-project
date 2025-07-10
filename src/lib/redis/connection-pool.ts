import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';

interface PoolOptions {
  maxConnections?: number;
  connectionTimeout?: number;
  maxRetriesPerRequest?: number;
}

interface ConnectionStats {
  created: number;
  active: number;
  idle: number;
  errors: number;
  lastError?: string;
}

/**
 * Singleton Redis connection pool manager for BullMQ
 * Prevents creating excessive connections to Upstash
 */
export class RedisConnectionPool {
  private static instance: RedisConnectionPool;
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private queueEvents: Map<string, QueueEvents>;
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private stats: ConnectionStats = {
    created: 0,
    active: 0,
    idle: 0,
    errors: 0,
  };

  private readonly options: Required<PoolOptions> = {
    maxConnections: 10,
    connectionTimeout: 30000,
    maxRetriesPerRequest: 3,
  };

  private constructor(options?: PoolOptions) {
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();
    this.options = { ...this.options, ...options };
    
    logger.info('Redis connection pool initialized', {
      options: this.options,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: PoolOptions): RedisConnectionPool {
    if (!RedisConnectionPool.instance) {
      RedisConnectionPool.instance = new RedisConnectionPool(options);
    }
    return RedisConnectionPool.instance;
  }

  /**
   * Get or create Redis connection
   */
  private async getConnection(): Promise<Redis> {
    if (this.redis && this.isConnected) {
      return this.redis;
    }

    try {
      // Check if we're in build environment
      if (process.env.BUILDING === 'true' || !process.env.REDIS_URL) {
        throw new Error('Redis not available in build environment');
      }

      logger.info('Creating new Redis connection');
      this.stats.created++;

      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: this.options.maxRetriesPerRequest,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.error('Redis connection failed after 3 retries');
            return null;
          }
          const delay = Math.min(times * 1000, 3000);
          logger.warn(`Retrying Redis connection in ${delay}ms`);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
          if (targetErrors.some(e => err.message.includes(e))) {
            return true;
          }
          return false;
        },
        enableReadyCheck: true,
        lazyConnect: true,
        connectionName: 'pokemon-tcg-pool',
        // Important: Disable offline queue to prevent buffering
        enableOfflineQueue: false,
      });

      // Set up event handlers
      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
        this.stats.active++;
      });

      this.redis.on('ready', () => {
        logger.info('Redis ready');
      });

      this.redis.on('error', (err) => {
        logger.error('Redis connection error', err);
        this.stats.errors++;
        this.stats.lastError = err.message;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
        this.stats.active--;
        this.stats.idle++;
      });

      // Connect with timeout
      await Promise.race([
        this.redis.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.options.connectionTimeout)
        ),
      ]);

      return this.redis;
    } catch (error) {
      logger.error('Failed to create Redis connection', error);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Get or create a queue instance
   */
  async getQueue(name: string): Promise<Queue> {
    // Return existing queue if available
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    try {
      const connection = await this.getConnection();
      
      const queue = new Queue(name, {
        connection,
        defaultJobOptions: {
          removeOnComplete: {
            age: 3600, // 1 hour
            count: 100, // Keep last 100
          },
          removeOnFail: {
            age: 86400, // 24 hours
            count: 500, // Keep last 500
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      this.queues.set(name, queue);
      logger.info(`Queue "${name}" created and cached`);
      
      return queue;
    } catch (error) {
      logger.error(`Failed to create queue "${name}"`, error);
      throw error;
    }
  }

  /**
   * Get or create a worker instance
   */
  async getWorker(name: string, processor: any): Promise<Worker> {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    try {
      const connection = await this.getConnection();
      
      const worker = new Worker(name, processor, {
        connection,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000, // 10 jobs per second
        },
      });

      this.workers.set(name, worker);
      logger.info(`Worker "${name}" created and cached`);
      
      return worker;
    } catch (error) {
      logger.error(`Failed to create worker "${name}"`, error);
      throw error;
    }
  }

  /**
   * Get or create queue events instance
   */
  async getQueueEvents(name: string): Promise<QueueEvents> {
    if (this.queueEvents.has(name)) {
      return this.queueEvents.get(name)!;
    }

    try {
      const connection = await this.getConnection();
      
      const events = new QueueEvents(name, { connection });
      this.queueEvents.set(name, events);
      logger.info(`Queue events "${name}" created and cached`);
      
      return events;
    } catch (error) {
      logger.error(`Failed to create queue events "${name}"`, error);
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return {
      ...this.stats,
      active: this.queues.size + this.workers.size + this.queueEvents.size,
      idle: this.stats.created - this.stats.active,
    };
  }

  /**
   * Close all connections and clean up
   */
  async close(): Promise<void> {
    logger.info('Closing Redis connection pool');

    // Close all queues
    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
        logger.info(`Queue "${name}" closed`);
      } catch (error) {
        logger.error(`Error closing queue "${name}"`, error);
      }
    }
    this.queues.clear();

    // Close all workers
    for (const [name, worker] of this.workers) {
      try {
        await worker.close();
        logger.info(`Worker "${name}" closed`);
      } catch (error) {
        logger.error(`Error closing worker "${name}"`, error);
      }
    }
    this.workers.clear();

    // Close all queue events
    for (const [name, events] of this.queueEvents) {
      try {
        await events.close();
        logger.info(`Queue events "${name}" closed`);
      } catch (error) {
        logger.error(`Error closing queue events "${name}"`, error);
      }
    }
    this.queueEvents.clear();

    // Close Redis connection
    if (this.redis) {
      try {
        await this.redis.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', error);
      }
      this.redis = null;
      this.isConnected = false;
    }

    // Reset instance
    RedisConnectionPool.instance = null as any;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.redis || !this.isConnected) {
        return false;
      }
      
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }
}

// Export singleton getter for convenience
export const getRedisPool = (options?: PoolOptions) => RedisConnectionPool.getInstance(options);