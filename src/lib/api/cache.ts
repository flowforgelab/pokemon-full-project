import { redis } from '@/server/db/redis';
import { z } from 'zod';
import type { CacheConfig } from './types';

export class CacheManager {
  private defaultTTL = 3600; // 1 hour in seconds
  private keyPrefix = 'pokemon-tcg:';

  constructor(private config?: Partial<CacheConfig>) {
    if (config?.prefix) {
      this.keyPrefix = config.prefix;
    }
    if (config?.ttl) {
      this.defaultTTL = config.ttl;
    }
  }

  /**
   * Generate a cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, schema?: z.ZodSchema<T>): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const value = await redis.get(cacheKey);
      
      if (!value) {
        return null;
      }

      const parsed = JSON.parse(value);
      
      // Validate with schema if provided
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          console.error(`Cache validation failed for key ${key}:`, result.error);
          // Remove invalid cache entry
          await this.delete(key);
          return null;
        }
        return result.data;
      }
      
      return parsed;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const serialized = JSON.stringify(value);
      const expiryTime = ttl || this.defaultTTL;
      
      await redis.setex(cacheKey, expiryTime, serialized);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const result = await redis.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getCacheKey(pattern);
      const keys = await redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await redis.del(...keys);
      return result;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const result = await redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const cacheKey = this.getCacheKey(key);
      return await redis.ttl(cacheKey);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Get or set a value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get(key, schema);
    if (cached !== null) {
      return cached;
    }

    // Generate new value
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Batch get multiple values
   */
  async mget<T>(keys: string[], schema?: z.ZodSchema<T>): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    
    if (keys.length === 0) {
      return result;
    }

    try {
      const cacheKeys = keys.map(key => this.getCacheKey(key));
      const values = await redis.mget(...cacheKeys);
      
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            const parsed = JSON.parse(value);
            
            if (schema) {
              const validationResult = schema.safeParse(parsed);
              if (validationResult.success) {
                result.set(key, validationResult.data);
              }
            } else {
              result.set(key, parsed);
            }
          } catch {
            // Ignore parse errors
          }
        }
      });
      
      return result;
    } catch (error) {
      console.error('Cache mget error:', error);
      return result;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const info = await redis.info('stats');
      const keyspace = await redis.info('keyspace');
      
      // Parse Redis info response
      const stats = {
        keys: 0,
        memory: '0',
        hits: 0,
        misses: 0,
      };
      
      // This is a simplified version - actual parsing would be more complex
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.startsWith('keyspace_hits:')) {
          stats.hits = parseInt(line.split(':')[1]);
        } else if (line.startsWith('keyspace_misses:')) {
          stats.misses = parseInt(line.split(':')[1]);
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        keys: 0,
        memory: '0',
        hits: 0,
        misses: 0,
      };
    }
  }
}

// Cache instances for different data types
export const cardCache = new CacheManager({
  prefix: 'pokemon-tcg:cards:',
  ttl: 86400, // 24 hours
});

export const priceCache = new CacheManager({
  prefix: 'pokemon-tcg:prices:',
  ttl: 3600, // 1 hour
});

export const setCache = new CacheManager({
  prefix: 'pokemon-tcg:sets:',
  ttl: 604800, // 7 days
});

export const searchCache = new CacheManager({
  prefix: 'pokemon-tcg:search:',
  ttl: 3600, // 1 hour
});

// Recommendation cache instance
export const recommendationCache = new CacheManager({
  prefix: 'pokemon-tcg:recommendations:',
  ttl: 3600, // 1 hour
});

export const analysisCache = new CacheManager({
  prefix: 'pokemon-tcg:analysis:',
  ttl: 3600, // 1 hour
});

export const metaCache = new CacheManager({
  prefix: 'pokemon-tcg:meta:',
  ttl: 86400, // 24 hours - meta data changes less frequently
});

// Cache warming utilities
export async function warmPopularCardsCache(cardIds: string[]): Promise<void> {
  console.log(`Warming cache for ${cardIds.length} popular cards...`);
  
  // This would be implemented with actual data fetching
  // For now, it's a placeholder
  for (const cardId of cardIds) {
    const key = `card:${cardId}`;
    const exists = await cardCache.exists(key);
    if (!exists) {
      // Fetch and cache the card data
      // This would call the Pokemon TCG API
    }
  }
}

export async function invalidateCardCache(cardId: string): Promise<void> {
  await cardCache.delete(`card:${cardId}`);
  await priceCache.delete(`price:${cardId}`);
  
  // Also invalidate any search results that might contain this card
  await searchCache.deletePattern(`*${cardId}*`);
}

export async function invalidateRecommendationCache(userId: string): Promise<void> {
  // Invalidate all recommendations for a user
  await recommendationCache.deletePattern(`${userId}:*`);
  
  // Also invalidate any analysis cache for user's decks
  await analysisCache.deletePattern(`user:${userId}:*`);
}

export async function invalidateMetaCache(format: string): Promise<void> {
  // Invalidate meta data for a specific format
  await metaCache.deletePattern(`${format}:*`);
}

/**
 * Cache key generators for consistent key formatting
 */
export const cacheKeys = {
  recommendation: (userId: string, type: string, hash: string) => 
    `${userId}:${type}:${hash}`,
    
  analysis: (deckId: string) => 
    `deck:${deckId}`,
    
  userAnalysis: (userId: string, deckId: string) => 
    `user:${userId}:deck:${deckId}`,
    
  meta: (format: string, date: string) => 
    `${format}:${date}`,
    
  collection: (userId: string) => 
    `collection:${userId}`,
    
  synergy: (card1Id: string, card2Id: string) => 
    `synergy:${[card1Id, card2Id].sort().join(':')}`,
}