import { PokemonTCGClient } from './pokemon-tcg-client';
import { TCGPlayerClient } from './tcgplayer-client';
import { 
  cardCache, 
  priceCache, 
  setCache, 
  searchCache,
  invalidateCardCache 
} from './cache';
import { 
  pokemonTCGQueue, 
  tcgPlayerQueue,
  pokemonTCGRateLimiter,
  tcgPlayerRateLimiter,
  JobPriority 
} from './rate-limiter';
import { 
  normalizeCardData, 
  normalizeSetData, 
  formatPricingData,
  transformAndValidateCard 
} from './transformers';
import { metricsCollector } from './monitoring';
import { 
  priceUpdateQueue, 
  setImportQueue, 
  cardSyncQueue,
  addPriorityJob 
} from '../jobs/queue';
import type { 
  PokemonTCGCard, 
  PokemonTCGSet, 
  SearchFilters,
  ApiError 
} from './types';

/**
 * Unified API service that combines all functionality
 */
export class PokemonTCGService {
  private pokemonClient: PokemonTCGClient;
  private tcgPlayerClient: TCGPlayerClient | null = null;
  private userId: string = 'system';

  constructor(userId?: string) {
    this.pokemonClient = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    
    if (process.env.TCGPLAYER_API_PUBLIC_KEY && process.env.TCGPLAYER_API_PRIVATE_KEY) {
      this.tcgPlayerClient = new TCGPlayerClient(
        process.env.TCGPLAYER_API_PUBLIC_KEY,
        process.env.TCGPLAYER_API_PRIVATE_KEY
      );
    }
    
    if (userId) {
      this.userId = userId;
    }
  }

  /**
   * Search for cards with caching and rate limiting
   */
  async searchCards(
    query?: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<{
    cards: PokemonTCGCard[];
    totalCount: number;
    page: number;
    pageSize: number;
    error?: ApiError;
  }> {
    const startTime = Date.now();
    const cacheKey = `search:${JSON.stringify({ query, filters, page, pageSize })}`;
    
    try {
      // Check cache first
      const cached = await searchCache.get(cacheKey);
      if (cached) {
        return cached as any;
      }
      
      // Make API call with rate limiting
      const result = await pokemonTCGQueue.enqueue(
        () => this.pokemonClient.searchCards(query, filters, page, pageSize),
        this.userId,
        JobPriority.HIGH
      );
      
      if (result.error) {
        throw result.error;
      }
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      const response = {
        cards: result.data.data,
        totalCount: result.data.totalCount,
        page: result.data.page,
        pageSize: result.data.pageSize,
      };
      
      // Cache the result
      await searchCache.set(cacheKey, response, 3600); // 1 hour cache
      
      // Record metrics
      await metricsCollector.recordApiCall({
        endpoint: '/cards/search',
        method: 'GET',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      });
      
      return response;
    } catch (error) {
      // Record error metrics
      await metricsCollector.recordApiCall({
        endpoint: '/cards/search',
        method: 'GET',
        statusCode: error instanceof ApiError ? error.statusCode || 500 : 500,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        cards: [],
        totalCount: 0,
        page,
        pageSize,
        error: error as ApiError,
      };
    }
  }

  /**
   * Get a single card with pricing
   */
  async getCard(cardId: string): Promise<{
    card?: PokemonTCGCard;
    prices?: any[];
    error?: ApiError;
  }> {
    const startTime = Date.now();
    
    try {
      // Check cache
      const cachedCard = await cardCache.get(`card:${cardId}`);
      const cachedPrices = await priceCache.get(`price:${cardId}`);
      
      if (cachedCard && cachedPrices) {
        return {
          card: cachedCard as PokemonTCGCard,
          prices: cachedPrices as any[],
        };
      }
      
      // Fetch card data
      const cardResult = cachedCard 
        ? { data: { data: cachedCard as PokemonTCGCard } }
        : await pokemonTCGQueue.enqueue(
            () => this.pokemonClient.getCardById(cardId),
            this.userId,
            JobPriority.HIGH
          );
      
      if (cardResult.error || !cardResult.data) {
        throw cardResult.error || new Error('Card not found');
      }
      
      const card = cardResult.data.data;
      
      // Cache card data
      if (!cachedCard) {
        await cardCache.set(`card:${cardId}`, card, 86400); // 24 hours
      }
      
      // Fetch prices if TCGPlayer is available
      let prices: any[] = [];
      if (this.tcgPlayerClient && card.tcgplayer?.url) {
        const tcgPlayerId = this.extractTCGPlayerIdFromUrl(card.tcgplayer.url);
        
        if (tcgPlayerId && !cachedPrices) {
          const priceResult = await tcgPlayerQueue.enqueue(
            () => this.tcgPlayerClient!.getMarketPrices(parseInt(tcgPlayerId)),
            this.userId,
            JobPriority.NORMAL
          );
          
          if (priceResult.data) {
            prices = priceResult.data;
            await priceCache.set(`price:${cardId}`, prices, 3600); // 1 hour
          }
        } else if (cachedPrices) {
          prices = cachedPrices as any[];
        }
      }
      
      // Record metrics
      await metricsCollector.recordApiCall({
        endpoint: '/cards/get',
        method: 'GET',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      });
      
      return { card, prices };
    } catch (error) {
      // Record error metrics
      await metricsCollector.recordApiCall({
        endpoint: '/cards/get',
        method: 'GET',
        statusCode: error instanceof ApiError ? error.statusCode || 500 : 500,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        error: error as ApiError,
      };
    }
  }

  /**
   * Get all sets
   */
  async getAllSets(): Promise<{
    sets: PokemonTCGSet[];
    error?: ApiError;
  }> {
    const startTime = Date.now();
    
    try {
      // Check cache
      const cached = await setCache.get('all-sets');
      if (cached) {
        return { sets: cached as PokemonTCGSet[] };
      }
      
      // Fetch all sets
      const sets: PokemonTCGSet[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const result = await pokemonTCGQueue.enqueue(
          () => this.pokemonClient.getAllSets(page, 250),
          this.userId,
          JobPriority.LOW
        );
        
        if (result.error || !result.data) {
          throw result.error || new Error('Failed to fetch sets');
        }
        
        sets.push(...result.data.data);
        
        if (result.data.data.length < 250) {
          hasMore = false;
        } else {
          page++;
        }
      }
      
      // Cache the result
      await setCache.set('all-sets', sets, 604800); // 7 days
      
      // Record metrics
      await metricsCollector.recordApiCall({
        endpoint: '/sets/all',
        method: 'GET',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      });
      
      return { sets };
    } catch (error) {
      // Record error metrics
      await metricsCollector.recordApiCall({
        endpoint: '/sets/all',
        method: 'GET',
        statusCode: error instanceof ApiError ? error.statusCode || 500 : 500,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        sets: [],
        error: error as ApiError,
      };
    }
  }

  /**
   * Queue a price update job
   */
  async queuePriceUpdate(
    scope: 'all' | 'popular' | 'specific',
    cardIds?: string[]
  ): Promise<{ jobId: string }> {
    const job = await addPriorityJob(
      priceUpdateQueue,
      `price-update-${scope}-${Date.now()}`,
      {
        type: 'UPDATE_PRICES',
        payload: { scope, cardIds },
      },
      scope === 'specific' ? JobPriority.HIGH : JobPriority.NORMAL
    );
    
    return { jobId: job.id || 'unknown' };
  }

  /**
   * Queue a set import job
   */
  async queueSetImport(setCode: string): Promise<{ jobId: string }> {
    const job = await addPriorityJob(
      setImportQueue,
      `import-set-${setCode}`,
      {
        type: 'IMPORT_SET',
        payload: { setCode, includeCards: true },
      },
      JobPriority.HIGH
    );
    
    return { jobId: job.id || 'unknown' };
  }

  /**
   * Queue a card sync job
   */
  async queueCardSync(
    scope: 'recent' | 'all' | 'specific',
    setIds?: string[]
  ): Promise<{ jobId: string }> {
    const job = await addPriorityJob(
      cardSyncQueue,
      `card-sync-${scope}-${Date.now()}`,
      {
        type: 'SYNC_CARDS',
        payload: { scope, setIds },
      },
      JobPriority.NORMAL
    );
    
    return { jobId: job.id || 'unknown' };
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<{
    pokemonTCG: any;
    tcgPlayer: any;
  }> {
    return {
      pokemonTCG: await pokemonTCGRateLimiter.getStatus(this.userId),
      tcgPlayer: await tcgPlayerRateLimiter.getStatus(this.userId),
    };
  }

  /**
   * Helper to extract TCGPlayer ID from URL
   */
  private extractTCGPlayerIdFromUrl(url: string): string | null {
    const match = url.match(/\/product\/(\d+)/);
    return match ? match[1] : null;
  }
}

// Export singleton instance for general use
export const pokemonTCGService = new PokemonTCGService();