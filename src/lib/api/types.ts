// API Response Types and Interfaces

// Pokemon TCG API Types
export interface PokemonTCGSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities: {
    standard?: string;
    expanded?: string;
    unlimited?: string;
  };
  ptcgoCode?: string;
  releaseDate: string;
  updatedAt: string;
  images: {
    symbol: string;
    logo: string;
  };
}

export interface PokemonTCGCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  level?: string;
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
  attacks?: Array<{
    name: string;
    cost: string[];
    damage: string;
    text: string;
    convertedEnergyCost: number;
  }>;
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    legalities: {
      standard?: string;
      expanded?: string;
      unlimited?: string;
    };
    ptcgoCode?: string;
    releaseDate: string;
    updatedAt: string;
    images: {
      symbol: string;
      logo: string;
    };
  };
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities: {
    standard?: string;
    expanded?: string;
    unlimited?: string;
  };
  regulationMark?: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      normal?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
      };
      holofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
      };
      reverseHolofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
      };
    };
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      reverseHoloTrend?: number;
    };
  };
}

export interface PokemonTCGApiResponse<T> {
  data: T;
  page?: number;
  pageSize?: number;
  count?: number;
  totalCount?: number;
}


// Rate Limiting Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface ApiCallResult<T> {
  data?: T;
  error?: ApiError;
  rateLimitInfo?: RateLimitInfo;
}

// Error Types
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = true,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message: string,
    public retryAfter: number,
    public limit: number,
    public remaining: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED', 401, true);
  }
}

export class NetworkError extends ApiError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, true);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public validationErrors?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, false);
  }
}

// Job Types
export interface JobData {
  type: 'UPDATE_PRICES' | 'IMPORT_SET' | 'SYNC_CARDS' | 'CLEANUP_DATA' | 'GENERATE_REPORT';
  payload: Record<string, any>;
  priority?: number;
  attempts?: number;
}

export interface JobResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Cache Types
export interface CacheConfig {
  ttl: number;
  prefix: string;
  compression?: boolean;
}

// Monitoring Types
export interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
}