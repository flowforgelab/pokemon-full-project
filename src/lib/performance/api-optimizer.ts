import { NextRequest, NextResponse } from 'next/server';
import { cacheManager, cardCache, searchCache, priceCache } from './cache-manager';
import { createHash } from 'crypto';

export interface CacheConfig {
  ttl?: number;
  tags?: string[];
  revalidate?: number;
  staleWhileRevalidate?: boolean;
}

export interface APIOptimizationOptions {
  cache?: CacheConfig;
  compress?: boolean;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

// Generate cache key from request
export function generateCacheKey(
  url: string,
  params?: Record<string, any>,
  userId?: string
): string {
  const hash = createHash('md5');
  hash.update(url);
  
  if (params) {
    hash.update(JSON.stringify(params));
  }
  
  if (userId) {
    hash.update(userId);
  }
  
  return hash.digest('hex');
}

// API response caching middleware
export function withCaching(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  config: CacheConfig = {}
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const url = req.url;
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const cacheKey = generateCacheKey(url, searchParams);
    
    // Try to get from cache
    const cached = await cacheManager.get<any>(cacheKey);
    
    if (cached) {
      // Check if stale
      const isStale = cached.timestamp + (config.ttl || 3600) * 1000 < Date.now();
      
      if (!isStale || config.staleWhileRevalidate) {
        const response = NextResponse.json(cached.data);
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Age', String(Date.now() - cached.timestamp));
        
        // Revalidate in background if stale
        if (isStale && config.staleWhileRevalidate) {
          revalidateInBackground(handler, req, args, cacheKey, config);
        }
        
        return response;
      }
    }
    
    // Execute handler
    const response = await handler(req, ...args);
    
    // Cache successful responses
    if (response.status === 200) {
      const data = await response.json();
      
      await cacheManager.set(
        cacheKey,
        {
          data,
          timestamp: Date.now(),
        },
        {
          strategy: {
            level: 'redis' as any,
            ttl: config.ttl || 3600,
            invalidation: 'time' as any,
            compression: true,
            encryption: false,
          },
          tags: config.tags,
        }
      );
      
      // Return new response with cache headers
      const newResponse = NextResponse.json(data);
      newResponse.headers.set('X-Cache', 'MISS');
      newResponse.headers.set('Cache-Control', `public, max-age=${config.ttl || 3600}`);
      
      return newResponse;
    }
    
    return response;
  };
}

// Background revalidation
async function revalidateInBackground(
  handler: Function,
  req: NextRequest,
  args: any[],
  cacheKey: string,
  config: CacheConfig
): Promise<void> {
  try {
    const response = await handler(req, ...args);
    
    if (response.status === 200) {
      const data = await response.json();
      
      await cacheManager.set(
        cacheKey,
        {
          data,
          timestamp: Date.now(),
        },
        {
          strategy: {
            level: 'redis' as any,
            ttl: config.ttl || 3600,
            invalidation: 'time' as any,
            compression: true,
            encryption: false,
          },
          tags: config.tags,
        }
      );
    }
  } catch (error) {
    console.error('Background revalidation failed:', error);
  }
}

// Batch API requests
export class BatchRequestProcessor {
  private batch: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }[]> = new Map();
  
  private batchTimeout?: NodeJS.Timeout;
  private batchSize = 50;
  private batchDelay = 50; // ms
  
  constructor(
    private processor: (requests: string[]) => Promise<Map<string, any>>,
    options?: {
      batchSize?: number;
      batchDelay?: number;
    }
  ) {
    if (options?.batchSize) this.batchSize = options.batchSize;
    if (options?.batchDelay) this.batchDelay = options.batchDelay;
  }
  
  async request(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.batch.has(key)) {
        this.batch.set(key, []);
      }
      
      this.batch.get(key)!.push({ resolve, reject });
      
      // Schedule batch processing
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.processBatch(), this.batchDelay);
      }
      
      // Process immediately if batch is full
      if (this.batch.size >= this.batchSize) {
        clearTimeout(this.batchTimeout);
        this.processBatch();
      }
    });
  }
  
  private async processBatch(): Promise<void> {
    this.batchTimeout = undefined;
    
    if (this.batch.size === 0) return;
    
    const currentBatch = new Map(this.batch);
    this.batch.clear();
    
    try {
      const keys = Array.from(currentBatch.keys());
      const results = await this.processor(keys);
      
      // Resolve promises
      for (const [key, callbacks] of currentBatch) {
        const result = results.get(key);
        
        if (result instanceof Error) {
          callbacks.forEach(({ reject }) => reject(result));
        } else {
          callbacks.forEach(({ resolve }) => resolve(result));
        }
      }
    } catch (error) {
      // Reject all promises on error
      for (const callbacks of currentBatch.values()) {
        callbacks.forEach(({ reject }) => reject(error));
      }
    }
  }
}

// Response compression
export function withCompression(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const response = await handler(req, ...args);
    
    // Check if client accepts compression
    const acceptEncoding = req.headers.get('accept-encoding') || '';
    
    if (acceptEncoding.includes('gzip') && response.body) {
      // Note: In production, this would be handled by the CDN/reverse proxy
      response.headers.set('Content-Encoding', 'gzip');
      response.headers.set('Vary', 'Accept-Encoding');
    }
    
    return response;
  };
}

// ETags for conditional requests
export function withETags(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const response = await handler(req, ...args);
    
    if (response.status === 200) {
      const data = await response.clone().text();
      const etag = createHash('md5').update(data).digest('hex');
      
      // Check if client has matching ETag
      const ifNoneMatch = req.headers.get('if-none-match');
      if (ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304 });
      }
      
      response.headers.set('ETag', etag);
    }
    
    return response;
  };
}

// API response optimization wrapper
export function optimizeAPIRoute(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  options: APIOptimizationOptions = {}
) {
  let optimizedHandler = handler;
  
  // Apply caching
  if (options.cache) {
    optimizedHandler = withCaching(optimizedHandler, options.cache);
  }
  
  // Apply compression
  if (options.compress) {
    optimizedHandler = withCompression(optimizedHandler);
  }
  
  // Apply ETags
  optimizedHandler = withETags(optimizedHandler);
  
  return optimizedHandler;
}

// Specialized cache invalidation
export class CacheInvalidator {
  static async invalidateCardData(cardId?: string): Promise<void> {
    if (cardId) {
      await cacheManager.invalidate(`card:${cardId}`);
    } else {
      await cacheManager.invalidate('cards', true);
    }
    
    // Also invalidate related searches
    await cacheManager.invalidate('search:*');
  }
  
  static async invalidatePriceData(cardId?: string): Promise<void> {
    if (cardId) {
      await cacheManager.invalidate(`price:${cardId}`);
    } else {
      await cacheManager.invalidate('prices', true);
    }
  }
  
  static async invalidateDeckData(deckId: string, userId: string): Promise<void> {
    await cacheManager.invalidate(`deck:${deckId}`);
    await cacheManager.invalidate(`user-decks:${userId}`);
  }
  
  static async invalidateCollectionData(userId: string): Promise<void> {
    await cacheManager.invalidate(`collection:${userId}`);
    await cacheManager.invalidate(`collection-stats:${userId}`);
  }
}

// Cache warming strategies
export class CacheWarmer {
  static async warmPopularCards(): Promise<void> {
    try {
      // Get popular card IDs from analytics
      const popularCardIds = await this.getPopularCardIds();
      
      // Warm cache for each card
      const promises = popularCardIds.map(async (cardId) => {
        const cached = await cardCache.get(cardId);
        if (!cached) {
          // Fetch and cache card data
          const card = await this.fetchCardData(cardId);
          if (card) {
            await cardCache.set(cardId, card);
          }
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }
  
  static async warmUserData(userId: string): Promise<void> {
    // Warm user-specific caches
    const warmingTasks = [
      this.warmUserDecks(userId),
      this.warmUserCollection(userId),
      this.warmUserStats(userId),
    ];
    
    await Promise.all(warmingTasks);
  }
  
  private static async getPopularCardIds(): Promise<string[]> {
    // This would query analytics or database for popular cards
    return [];
  }
  
  private static async fetchCardData(cardId: string): Promise<any> {
    // Fetch card data from database
    return null;
  }
  
  private static async warmUserDecks(userId: string): Promise<void> {
    // Warm user decks cache
  }
  
  private static async warmUserCollection(userId: string): Promise<void> {
    // Warm user collection cache
  }
  
  private static async warmUserStats(userId: string): Promise<void> {
    // Warm user statistics cache
  }
}