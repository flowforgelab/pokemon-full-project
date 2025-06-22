import { z } from 'zod';
import { BaseApiClient } from './base-client';
import type { 
  PokemonTCGSet, 
  PokemonTCGCard, 
  PokemonTCGApiResponse,
  ApiCallResult 
} from './types';

// Zod schemas for validation
const PokemonTCGSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  series: z.string(),
  printedTotal: z.number(),
  total: z.number(),
  legalities: z.object({
    standard: z.string().optional(),
    expanded: z.string().optional(),
    unlimited: z.string().optional(),
  }),
  ptcgoCode: z.string().optional(),
  releaseDate: z.string(),
  updatedAt: z.string(),
  images: z.object({
    symbol: z.string(),
    logo: z.string(),
  }),
});

const PokemonTCGCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  supertype: z.string(),
  subtypes: z.array(z.string()).optional(),
  level: z.string().optional(),
  hp: z.string().optional(),
  types: z.array(z.string()).optional(),
  evolvesFrom: z.string().optional(),
  evolvesTo: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
  attacks: z.array(z.object({
    name: z.string(),
    cost: z.array(z.string()),
    damage: z.string(),
    text: z.string(),
    convertedEnergyCost: z.number(),
  })).optional(),
  abilities: z.array(z.object({
    name: z.string(),
    text: z.string(),
    type: z.string(),
  })).optional(),
  weaknesses: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).optional(),
  resistances: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).optional(),
  retreatCost: z.array(z.string()).optional(),
  convertedRetreatCost: z.number().optional(),
  set: PokemonTCGSetSchema,
  number: z.string(),
  artist: z.string().optional(),
  rarity: z.string().optional(),
  flavorText: z.string().optional(),
  nationalPokedexNumbers: z.array(z.number()).optional(),
  legalities: z.object({
    standard: z.string().optional(),
    expanded: z.string().optional(),
    unlimited: z.string().optional(),
  }),
  regulationMark: z.string().optional(),
  images: z.object({
    small: z.string(),
    large: z.string(),
  }),
  tcgplayer: z.object({
    url: z.string(),
    updatedAt: z.string(),
    prices: z.object({
      normal: z.object({
        low: z.number().optional(),
        mid: z.number().optional(),
        high: z.number().optional(),
        market: z.number().optional(),
      }).optional(),
      holofoil: z.object({
        low: z.number().optional(),
        mid: z.number().optional(),
        high: z.number().optional(),
        market: z.number().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
  cardmarket: z.object({
    url: z.string(),
    updatedAt: z.string(),
    prices: z.object({
      averageSellPrice: z.number().optional(),
      lowPrice: z.number().optional(),
      trendPrice: z.number().optional(),
      reverseHoloTrend: z.number().optional(),
    }),
  }).optional(),
});

export interface SearchFilters {
  name?: string;
  supertype?: string;
  subtypes?: string[];
  types?: string[];
  hp?: string;
  rarity?: string[];
  set?: string;
  series?: string;
  artist?: string;
  pokedex?: number[];
  evolvesFrom?: string;
  evolvesTo?: string;
  retreatCost?: number;
  convertedRetreatCost?: number;
  number?: string;
  tcgplayer?: boolean;
  nationalPokedexNumbers?: number[];
  legalities?: {
    standard?: boolean;
    expanded?: boolean;
    unlimited?: boolean;
  };
}

export class PokemonTCGClient extends BaseApiClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    super({
      baseUrl: process.env.POKEMON_TCG_API_URL || 'https://api.pokemontcg.io/v2',
      headers: apiKey ? { 'X-Api-Key': apiKey } : {},
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitConfig: {
        maxRequests: 1000,
        windowMs: 60 * 60 * 1000, // 1 hour
      },
    });
    this.apiKey = apiKey;
  }

  protected getRateLimitKey(): string {
    return 'pokemon-tcg-api';
  }

  /**
   * Get all Pokemon TCG sets with pagination
   */
  async getAllSets(page = 1, pageSize = 250): Promise<ApiCallResult<PokemonTCGApiResponse<PokemonTCGSet[]>>> {
    const schema = z.object({
      data: z.array(PokemonTCGSetSchema),
      page: z.number(),
      pageSize: z.number(),
      count: z.number(),
      totalCount: z.number(),
    });

    return this.request<PokemonTCGApiResponse<PokemonTCGSet[]>>(
      `/sets?page=${page}&pageSize=${pageSize}`,
      { method: 'GET' },
      schema
    );
  }

  /**
   * Get a specific set by code
   */
  async getSetByCode(code: string): Promise<ApiCallResult<PokemonTCGApiResponse<PokemonTCGSet>>> {
    const schema = z.object({
      data: PokemonTCGSetSchema,
    });

    return this.request<PokemonTCGApiResponse<PokemonTCGSet>>(
      `/sets/${encodeURIComponent(code)}`,
      { method: 'GET' },
      schema
    );
  }

  /**
   * Get all cards from a specific set
   */
  async getCardsBySet(
    setCode: string, 
    page = 1, 
    pageSize = 250
  ): Promise<ApiCallResult<PokemonTCGApiResponse<PokemonTCGCard[]>>> {
    const schema = z.object({
      data: z.array(PokemonTCGCardSchema),
      page: z.number(),
      pageSize: z.number(),
      count: z.number(),
      totalCount: z.number(),
    });

    return this.request<PokemonTCGApiResponse<PokemonTCGCard[]>>(
      `/cards?q=set.id:${encodeURIComponent(setCode)}&page=${page}&pageSize=${pageSize}`,
      { method: 'GET' },
      schema
    );
  }

  /**
   * Search cards with advanced filtering
   */
  async searchCards(
    query?: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 250
  ): Promise<ApiCallResult<PokemonTCGApiResponse<PokemonTCGCard[]>>> {
    const queryParts: string[] = [];

    // Add free text search
    if (query) {
      queryParts.push(`name:"*${query}*"`);
    }

    // Add filters
    if (filters) {
      if (filters.supertype) queryParts.push(`supertype:${filters.supertype}`);
      if (filters.subtypes?.length) {
        queryParts.push(`subtypes:${filters.subtypes.join(' OR subtypes:')}`);
      }
      if (filters.types?.length) {
        queryParts.push(`types:${filters.types.join(' OR types:')}`);
      }
      if (filters.hp) queryParts.push(`hp:${filters.hp}`);
      if (filters.rarity?.length) {
        queryParts.push(`rarity:${filters.rarity.join(' OR rarity:')}`);
      }
      if (filters.set) queryParts.push(`set.id:${filters.set}`);
      if (filters.series) queryParts.push(`set.series:${filters.series}`);
      if (filters.artist) queryParts.push(`artist:"${filters.artist}"`);
      if (filters.evolvesFrom) queryParts.push(`evolvesFrom:"${filters.evolvesFrom}"`);
      if (filters.number) queryParts.push(`number:${filters.number}`);
      if (filters.nationalPokedexNumbers?.length) {
        queryParts.push(
          `nationalPokedexNumbers:[${filters.nationalPokedexNumbers.join(' OR ')}]`
        );
      }
      if (filters.legalities?.standard === true) {
        queryParts.push('legalities.standard:legal');
      }
      if (filters.legalities?.expanded === true) {
        queryParts.push('legalities.expanded:legal');
      }
    }

    const queryString = queryParts.length > 0 ? `q=${encodeURIComponent(queryParts.join(' '))}` : '';

    const schema = z.object({
      data: z.array(PokemonTCGCardSchema),
      page: z.number(),
      pageSize: z.number(),
      count: z.number(),
      totalCount: z.number(),
    });

    return this.request<PokemonTCGApiResponse<PokemonTCGCard[]>>(
      `/cards?${queryString}&page=${page}&pageSize=${pageSize}`,
      { method: 'GET' },
      schema
    );
  }

  /**
   * Get a specific card by ID
   */
  async getCardById(id: string): Promise<ApiCallResult<PokemonTCGApiResponse<PokemonTCGCard>>> {
    const schema = z.object({
      data: PokemonTCGCardSchema,
    });

    return this.request<PokemonTCGApiResponse<PokemonTCGCard>>(
      `/cards/${encodeURIComponent(id)}`,
      { method: 'GET' },
      schema
    );
  }

  /**
   * Get multiple cards by IDs (batch request)
   */
  async getCardsByIds(ids: string[]): Promise<ApiCallResult<PokemonTCGApiResponse<PokemonTCGCard[]>>> {
    const idQuery = ids.map(id => `id:"${id}"`).join(' OR ');
    
    const schema = z.object({
      data: z.array(PokemonTCGCardSchema),
      page: z.number(),
      pageSize: z.number(),
      count: z.number(),
      totalCount: z.number(),
    });

    return this.request<PokemonTCGApiResponse<PokemonTCGCard[]>>(
      `/cards?q=${encodeURIComponent(idQuery)}&pageSize=250`,
      { method: 'GET' },
      schema
    );
  }

  /**
   * Get rarities
   */
  async getRarities(): Promise<ApiCallResult<{ data: string[] }>> {
    return this.request<{ data: string[] }>('/rarities', { method: 'GET' });
  }

  /**
   * Get supertypes
   */
  async getSupertypes(): Promise<ApiCallResult<{ data: string[] }>> {
    return this.request<{ data: string[] }>('/supertypes', { method: 'GET' });
  }

  /**
   * Get subtypes
   */
  async getSubtypes(): Promise<ApiCallResult<{ data: string[] }>> {
    return this.request<{ data: string[] }>('/subtypes', { method: 'GET' });
  }

  /**
   * Get types
   */
  async getTypes(): Promise<ApiCallResult<{ data: string[] }>> {
    return this.request<{ data: string[] }>('/types', { method: 'GET' });
  }
}