import { createClient, RedisClientType } from 'redis';
import LRU from 'lru-cache';
import { compress, decompress } from '@/lib/utils/compression';
import { encrypt, decrypt } from '@/lib/utils/encryption';

export enum CacheLevel {
  MEMORY = 'memory',
  REDIS = 'redis',
  CDN = 'cdn',
  BROWSER = 'browser',
}

export enum CacheInvalidation {
  TIME = 'time',
  EVENT = 'event',
  MANUAL = 'manual',
}

export interface CacheStrategy {
  level: CacheLevel;
  ttl: number; // seconds
  invalidation: CacheInvalidation;
  compression: boolean;
  encryption: boolean;
  tags?: string[];
}

export interface CacheOptions {
  strategy?: CacheStrategy;
  tags?: string[];
  priority?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  entries: number;
  evictions: number;
}

export interface CacheEntry<T> {
  value: T;
  expires: number;
  tags: string[];
  compressed: boolean;
  encrypted: boolean;
}

class MultiLevelCacheManager {
  private memoryCache: LRU<string, any>;
  private redisClient: RedisClientType | null = null;
  private stats = {
    memory: { hits: 0, misses: 0, evictions: 0 },
    redis: { hits: 0, misses: 0, evictions: 0 },
  };

  constructor() {
    // Initialize memory cache with 100MB limit
    this.memoryCache = new LRU({
      max: 100 * 1024 * 1024, // 100MB
      maxSize: (value) => {
        return JSON.stringify(value).length;
      },
      ttl: 1000 * 60 * 5, // 5 minutes default
      dispose: () => {
        this.stats.memory.evictions++;
      },
    });

    this.initRedis();
  }

  private async initRedis() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.warn('Redis not configured, using memory cache only');
      return;
    }

    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || process.env.KV_REST_API_URL,
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      await this.redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.redisClient = null;
    }
  }

  // Get value from cache with multi-level fallback
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const strategy = options?.strategy || this.getDefaultStrategy();
    
    // Level 1: Memory cache
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      this.stats.memory.hits++;
      return this.deserializeValue<T>(memoryValue);
    }
    this.stats.memory.misses++;

    // Level 2: Redis cache
    if (this.redisClient && strategy.level !== CacheLevel.MEMORY) {
      try {
        const redisValue = await this.redisClient.get(key);
        if (redisValue) {
          this.stats.redis.hits++;
          const entry = JSON.parse(redisValue) as CacheEntry<T>;
          
          // Check expiration
          if (entry.expires > Date.now()) {
            // Decompress if needed
            let value = entry.value;
            if (entry.compressed) {
              value = await decompress(value as any);
            }
            
            // Decrypt if needed
            if (entry.encrypted) {
              value = await decrypt(value as any);
            }
            
            // Populate memory cache
            this.memoryCache.set(key, value, {
              ttl: Math.min(entry.expires - Date.now(), 1000 * 60 * 5),
            });
            
            return value;
          }
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }
    this.stats.redis.misses++;

    return null;
  }

  // Set value in cache with strategy
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    const strategy = options?.strategy || this.getDefaultStrategy();
    const tags = options?.tags || [];
    
    // Serialize value
    const serialized = await this.serializeValue(value, strategy);
    
    // Level 1: Memory cache
    if (strategy.level === CacheLevel.MEMORY || strategy.level === CacheLevel.REDIS) {
      this.memoryCache.set(key, serialized, {
        ttl: Math.min(strategy.ttl * 1000, 1000 * 60 * 5), // Max 5 min in memory
      });
    }

    // Level 2: Redis cache
    if (this.redisClient && strategy.level !== CacheLevel.MEMORY) {
      try {
        const entry: CacheEntry<any> = {
          value: serialized,
          expires: Date.now() + strategy.ttl * 1000,
          tags,
          compressed: strategy.compression,
          encrypted: strategy.encryption,
        };
        
        await this.redisClient.setEx(
          key,
          strategy.ttl,
          JSON.stringify(entry)
        );
        
        // Track tags for invalidation
        if (tags.length > 0) {
          await this.trackTags(key, tags);
        }
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
  }

  // Invalidate cache by pattern or tags
  async invalidate(pattern: string, byTags?: boolean): Promise<void> {
    if (byTags) {
      await this.invalidateByTags([pattern]);
    } else {
      await this.invalidateByPattern(pattern);
    }
  }

  // Invalidate by pattern
  private async invalidateByPattern(pattern: string): Promise<void> {
    // Clear from memory cache
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from Redis
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (error) {
        console.error('Redis invalidate error:', error);
      }
    }
  }

  // Invalidate by tags
  private async invalidateByTags(tags: string[]): Promise<void> {
    if (!this.redisClient) return;

    try {
      // Get all keys associated with tags
      const keySets = await Promise.all(
        tags.map(tag => this.redisClient!.sMembers(`tag:${tag}`))
      );
      
      const keys = [...new Set(keySets.flat())];
      
      if (keys.length > 0) {
        // Remove from memory cache
        keys.forEach(key => this.memoryCache.delete(key));
        
        // Remove from Redis
        await this.redisClient.del(keys);
        
        // Clean up tag sets
        await Promise.all(
          tags.map(tag => this.redisClient!.del(`tag:${tag}`))
        );
      }
    } catch (error) {
      console.error('Tag invalidation error:', error);
    }
  }

  // Track tags for cache entries
  private async trackTags(key: string, tags: string[]): Promise<void> {
    if (!this.redisClient) return;

    try {
      await Promise.all(
        tags.map(tag => this.redisClient!.sAdd(`tag:${tag}`, key))
      );
    } catch (error) {
      console.error('Tag tracking error:', error);
    }
  }

  // Get cache statistics
  async stats(): Promise<{
    memory: CacheStats;
    redis: CacheStats;
    combined: CacheStats;
  }> {
    const memoryStats: CacheStats = {
      hits: this.stats.memory.hits,
      misses: this.stats.memory.misses,
      hitRate: this.stats.memory.hits / (this.stats.memory.hits + this.stats.memory.misses) || 0,
      size: this.memoryCache.size,
      entries: this.memoryCache.size,
      evictions: this.stats.memory.evictions,
    };

    const redisStats: CacheStats = {
      hits: this.stats.redis.hits,
      misses: this.stats.redis.misses,
      hitRate: this.stats.redis.hits / (this.stats.redis.hits + this.stats.redis.misses) || 0,
      size: 0,
      entries: 0,
      evictions: this.stats.redis.evictions,
    };

    // Get Redis stats if available
    if (this.redisClient) {
      try {
        const info = await this.redisClient.info('memory');
        const dbSize = await this.redisClient.dbSize();
        
        redisStats.size = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
        redisStats.entries = dbSize;
      } catch (error) {
        console.error('Failed to get Redis stats:', error);
      }
    }

    const combinedHits = memoryStats.hits + redisStats.hits;
    const combinedMisses = memoryStats.misses + redisStats.misses;

    return {
      memory: memoryStats,
      redis: redisStats,
      combined: {
        hits: combinedHits,
        misses: combinedMisses,
        hitRate: combinedHits / (combinedHits + combinedMisses) || 0,
        size: memoryStats.size + redisStats.size,
        entries: memoryStats.entries + redisStats.entries,
        evictions: memoryStats.evictions + redisStats.evictions,
      },
    };
  }

  // Cache warming
  async warm(keys: string[], fetcher: (key: string) => Promise<any>): Promise<void> {
    const promises = keys.map(async (key) => {
      const value = await this.get(key);
      if (!value) {
        const freshValue = await fetcher(key);
        if (freshValue) {
          await this.set(key, freshValue);
        }
      }
    });

    await Promise.all(promises);
  }

  // Clear all caches
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.redisClient) {
      try {
        await this.redisClient.flushDb();
      } catch (error) {
        console.error('Failed to clear Redis:', error);
      }
    }
  }

  // Helper methods
  private getDefaultStrategy(): CacheStrategy {
    return {
      level: CacheLevel.REDIS,
      ttl: 3600, // 1 hour
      invalidation: CacheInvalidation.TIME,
      compression: false,
      encryption: false,
    };
  }

  private async serializeValue<T>(value: T, strategy: CacheStrategy): Promise<any> {
    let serialized = value;
    
    if (strategy.compression) {
      serialized = await compress(JSON.stringify(serialized)) as any;
    }
    
    if (strategy.encryption) {
      serialized = await encrypt(serialized as any) as any;
    }
    
    return serialized;
  }

  private async deserializeValue<T>(value: any): Promise<T> {
    return value as T;
  }
}

// Specialized cache instances
export class CacheFactory {
  private static cacheManager = new MultiLevelCacheManager();

  // Card data cache (24 hour TTL)
  static cardCache = {
    get: async <T>(key: string): Promise<T | null> => {
      return CacheFactory.cacheManager.get<T>(`card:${key}`, {
        strategy: {
          level: CacheLevel.REDIS,
          ttl: 86400, // 24 hours
          invalidation: CacheInvalidation.TIME,
          compression: true,
          encryption: false,
        },
      });
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      return CacheFactory.cacheManager.set(`card:${key}`, value, {
        strategy: {
          level: CacheLevel.REDIS,
          ttl: 86400, // 24 hours
          invalidation: CacheInvalidation.TIME,
          compression: true,
          encryption: false,
        },
        tags: ['cards'],
      });
    },
    invalidate: async (): Promise<void> => {
      return CacheFactory.cacheManager.invalidate('cards', true);
    },
  };

  // Search result cache (1 hour TTL)
  static searchCache = {
    get: async <T>(key: string): Promise<T | null> => {
      return CacheFactory.cacheManager.get<T>(`search:${key}`, {
        strategy: {
          level: CacheLevel.REDIS,
          ttl: 3600, // 1 hour
          invalidation: CacheInvalidation.TIME,
          compression: true,
          encryption: false,
        },
      });
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      return CacheFactory.cacheManager.set(`search:${key}`, value, {
        strategy: {
          level: CacheLevel.REDIS,
          ttl: 3600, // 1 hour
          invalidation: CacheInvalidation.TIME,
          compression: true,
          encryption: false,
        },
        tags: ['search'],
      });
    },
  };

  // Price data cache (1 hour TTL)
  static priceCache = {
    get: async <T>(key: string): Promise<T | null> => {
      return CacheFactory.cacheManager.get<T>(`price:${key}`, {
        strategy: {
          level: CacheLevel.REDIS,
          ttl: 3600, // 1 hour
          invalidation: CacheInvalidation.TIME,
          compression: false,
          encryption: false,
        },
      });
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      return CacheFactory.cacheManager.set(`price:${key}`, value, {
        strategy: {
          level: CacheLevel.REDIS,
          ttl: 3600, // 1 hour
          invalidation: CacheInvalidation.TIME,
          compression: false,
          encryption: false,
        },
        tags: ['prices'],
      });
    },
  };

  // User session cache (5 minutes TTL, memory only)
  static sessionCache = {
    get: async <T>(key: string): Promise<T | null> => {
      return CacheFactory.cacheManager.get<T>(`session:${key}`, {
        strategy: {
          level: CacheLevel.MEMORY,
          ttl: 300, // 5 minutes
          invalidation: CacheInvalidation.TIME,
          compression: false,
          encryption: true,
        },
      });
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      return CacheFactory.cacheManager.set(`session:${key}`, value, {
        strategy: {
          level: CacheLevel.MEMORY,
          ttl: 300, // 5 minutes
          invalidation: CacheInvalidation.TIME,
          compression: false,
          encryption: true,
        },
      });
    },
  };

  // Get cache manager instance
  static getCacheManager(): MultiLevelCacheManager {
    return CacheFactory.cacheManager;
  }
}

// Export cache instances
export const cacheManager = CacheFactory.getCacheManager();
export const { cardCache, searchCache, priceCache, sessionCache } = CacheFactory;