import { redis } from '@/server/db/redis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/**
 * Token bucket rate limiter implementation
 */
export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private keyPrefix: string;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.keyPrefix = config.keyPrefix || 'rate-limit:';
  }

  /**
   * Check if a request is allowed under the rate limit
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    try {
      // Use Redis sorted set to store timestamps of requests
      // Remove old entries outside the window
      await redis.zremrangebyscore(key, '-inf', windowStart.toString());
      
      // Count requests in the current window
      const count = await redis.zcard(key);
      
      if (count >= this.maxRequests) {
        // Get the oldest request timestamp to calculate retry after
        const oldestTimestamp = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const retryAfter = oldestTimestamp.length > 1 
          ? Math.ceil((parseInt(oldestTimestamp[1]) + this.windowMs - now) / 1000)
          : Math.ceil(this.windowMs / 1000);
        
        return {
          allowed: false,
          limit: this.maxRequests,
          remaining: 0,
          reset: new Date(parseInt(oldestTimestamp[1]) + this.windowMs),
          retryAfter,
        };
      }
      
      // Add current request
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiry on the key
      await redis.expire(key, Math.ceil(this.windowMs / 1000));
      
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - count - 1,
        reset: new Date(now + this.windowMs),
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: new Date(now + this.windowMs),
      };
    }
  }

  /**
   * Get current limit status without consuming a token
   */
  async getStatus(identifier: string): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    try {
      // Remove old entries
      await redis.zremrangebyscore(key, '-inf', windowStart.toString());
      
      // Count current requests
      const count = await redis.zcard(key);
      
      return {
        allowed: count < this.maxRequests,
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - count),
        reset: new Date(now + this.windowMs),
      };
    } catch (error) {
      console.error('Rate limiter status error:', error);
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: new Date(now + this.windowMs),
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}${identifier}`;
    await redis.del(key);
  }
}

/**
 * Distributed rate limiter with multiple buckets
 */
export class DistributedRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  /**
   * Add a rate limiter for a specific API
   */
  addLimiter(name: string, config: RateLimitConfig): void {
    this.limiters.set(name, new RateLimiter({
      ...config,
      keyPrefix: `rate-limit:${name}:`,
    }));
  }

  /**
   * Check rate limit for a specific API
   */
  async checkLimit(name: string, identifier: string): Promise<RateLimitResult> {
    const limiter = this.limiters.get(name);
    if (!limiter) {
      throw new Error(`Rate limiter '${name}' not found`);
    }
    return limiter.checkLimit(identifier);
  }

  /**
   * Get status for all limiters
   */
  async getAllStatus(identifier: string): Promise<Map<string, RateLimitResult>> {
    const results = new Map<string, RateLimitResult>();
    
    for (const [name, limiter] of this.limiters) {
      results.set(name, await limiter.getStatus(identifier));
    }
    
    return results;
  }
}

// Priority queue for API requests
export interface QueuedRequest {
  id: string;
  priority: number;
  timestamp: number;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class PriorityRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private rateLimiter: RateLimiter;
  private concurrency: number;
  private activeRequests = 0;

  constructor(rateLimiter: RateLimiter, concurrency = 5) {
    this.rateLimiter = rateLimiter;
    this.concurrency = concurrency;
  }

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    identifier: string,
    priority = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${Date.now()}-${Math.random()}`,
        priority,
        timestamp: Date.now(),
        execute,
        resolve,
        reject,
      };
      
      // Insert in priority order (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }
      
      // Start processing if not already running
      if (!this.processing) {
        this.process(identifier);
      }
    });
  }

  /**
   * Process the queue
   */
  private async process(identifier: string): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeRequests < this.concurrency) {
      // Check rate limit
      const limitResult = await this.rateLimiter.checkLimit(identifier);
      
      if (!limitResult.allowed) {
        // Wait before retrying
        await new Promise(resolve => 
          setTimeout(resolve, (limitResult.retryAfter || 1) * 1000)
        );
        continue;
      }
      
      // Get next request
      const request = this.queue.shift();
      if (!request) break;
      
      this.activeRequests++;
      
      // Execute request
      request.execute()
        .then(result => request.resolve(result))
        .catch(error => request.reject(error))
        .finally(() => {
          this.activeRequests--;
          // Continue processing
          if (this.queue.length > 0) {
            this.process(identifier);
          }
        });
    }
    
    if (this.queue.length === 0 && this.activeRequests === 0) {
      this.processing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    activeRequests: number;
    processing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

// Pre-configured rate limiters
export const pokemonTCGRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 1000,
  keyPrefix: 'rate-limit:pokemon-tcg:',
});


// Global distributed rate limiter
export const globalRateLimiter = new DistributedRateLimiter();
globalRateLimiter.addLimiter('pokemon-tcg', {
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
});

// Priority queues for each API
export const pokemonTCGQueue = new PriorityRequestQueue(pokemonTCGRateLimiter);
