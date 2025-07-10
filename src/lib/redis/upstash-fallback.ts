/**
 * Upstash Redis Fallback Handler
 * 
 * Handles rate limit errors and provides fallback functionality
 * when Upstash request limits are exceeded
 */

import { logger } from '@/lib/logger';

export interface UpstashRateLimitError {
  message: string;
  limit: number;
  usage: number;
}

export class UpstashFallbackHandler {
  private static rateLimitExceeded = false;
  private static lastRateLimitError: Date | null = null;
  private static resetAfterMs = 60 * 60 * 1000; // 1 hour

  /**
   * Check if we're currently rate limited
   */
  static isRateLimited(): boolean {
    if (!this.rateLimitExceeded) return false;
    
    // Check if we should reset
    if (this.lastRateLimitError) {
      const timeSinceError = Date.now() - this.lastRateLimitError.getTime();
      if (timeSinceError > this.resetAfterMs) {
        this.rateLimitExceeded = false;
        this.lastRateLimitError = null;
        logger.info('Upstash rate limit reset after timeout');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Handle rate limit error
   */
  static handleRateLimitError(error: any): void {
    if (error.message?.includes('max requests limit exceeded')) {
      this.rateLimitExceeded = true;
      this.lastRateLimitError = new Date();
      
      // Extract limit and usage from error message
      const limitMatch = error.message.match(/Limit: (\d+)/);
      const usageMatch = error.message.match(/Usage: (\d+)/);
      
      const limit = limitMatch ? parseInt(limitMatch[1]) : 500000;
      const usage = usageMatch ? parseInt(usageMatch[1]) : 500000;
      
      logger.error('Upstash rate limit exceeded', {
        limit,
        usage,
        percentage: ((usage / limit) * 100).toFixed(2) + '%',
        willResetAt: new Date(Date.now() + this.resetAfterMs).toISOString()
      });
    }
  }

  /**
   * Get fallback Redis options for local development
   */
  static getFallbackRedisOptions(): any {
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null, // Don't retry local connection
    };
  }

  /**
   * Determine if we should use local Redis
   */
  static shouldUseLocalRedis(): boolean {
    // Use local Redis if:
    // 1. We're rate limited by Upstash
    // 2. We're in development mode without REDIS_URL
    // 3. FORCE_LOCAL_REDIS env var is set
    
    if (this.isRateLimited()) {
      logger.warn('Using local Redis due to Upstash rate limit');
      return true;
    }
    
    if (process.env.FORCE_LOCAL_REDIS === 'true') {
      logger.info('Using local Redis (forced by env var)');
      return true;
    }
    
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      logger.info('Using local Redis (development mode without REDIS_URL)');
      return true;
    }
    
    return false;
  }

  /**
   * Get Redis connection options with fallback
   */
  static getConnectionOptions(): any {
    if (this.shouldUseLocalRedis()) {
      return this.getFallbackRedisOptions();
    }
    
    // Try to use Upstash first
    const upstashUrl = process.env.REDIS_URL || process.env.KV_URL;
    if (!upstashUrl) {
      logger.warn('No Redis URL found, using local Redis');
      return this.getFallbackRedisOptions();
    }
    
    try {
      const url = new URL(upstashUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || process.env.KV_REST_API_TOKEN,
        username: url.username || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1, // Minimal retries to fail fast on rate limit
        tls: upstashUrl.startsWith('rediss://') ? {} : undefined,
        retryStrategy: (times: number) => {
          if (times > 1) return null; // Give up quickly
          return 1000; // 1 second retry
        },
      };
    } catch (error) {
      logger.error('Failed to parse Redis URL, using local Redis', error);
      return this.getFallbackRedisOptions();
    }
  }

  /**
   * Wrap Redis operation with rate limit handling
   */
  static async wrapOperation<T>(
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    try {
      if (this.isRateLimited() && fallback) {
        logger.info('Skipping Redis operation due to rate limit, using fallback');
        return await fallback();
      }
      
      return await operation();
    } catch (error: any) {
      this.handleRateLimitError(error);
      
      if (fallback) {
        logger.warn('Redis operation failed, using fallback', { error: error.message });
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Reset rate limit status (for testing or manual override)
   */
  static resetRateLimit(): void {
    this.rateLimitExceeded = false;
    this.lastRateLimitError = null;
    logger.info('Upstash rate limit status reset');
  }
}

// In-memory job queue for fallback
export class InMemoryJobQueue {
  private jobs: Map<string, any[]> = new Map();
  private jobIdCounter = 0;

  add(queueName: string, jobData: any): any {
    if (!this.jobs.has(queueName)) {
      this.jobs.set(queueName, []);
    }
    
    const job = {
      id: `memory-job-${++this.jobIdCounter}`,
      data: jobData,
      status: 'waiting',
      createdAt: new Date(),
    };
    
    this.jobs.get(queueName)!.push(job);
    logger.info(`Added job to in-memory queue: ${queueName}`, { jobId: job.id });
    
    return job;
  }

  getJobs(queueName: string): any[] {
    return this.jobs.get(queueName) || [];
  }

  getJob(queueName: string, jobId: string): any {
    const jobs = this.jobs.get(queueName) || [];
    return jobs.find(j => j.id === jobId);
  }

  updateJobStatus(queueName: string, jobId: string, status: string, result?: any): void {
    const jobs = this.jobs.get(queueName) || [];
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      job.status = status;
      if (result !== undefined) {
        job.result = result;
      }
      job.updatedAt = new Date();
    }
  }

  clear(queueName?: string): void {
    if (queueName) {
      this.jobs.delete(queueName);
    } else {
      this.jobs.clear();
    }
  }
}

// Export singleton instance
export const inMemoryQueue = new InMemoryJobQueue();