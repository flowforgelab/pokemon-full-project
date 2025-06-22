// API Configuration

export const API_CONFIG = {
  // Pokemon TCG API
  POKEMON_TCG: {
    BASE_URL: process.env.POKEMON_TCG_API_URL || 'https://api.pokemontcg.io/v2',
    API_KEY: process.env.POKEMON_TCG_API_KEY,
    RATE_LIMIT: {
      MAX_REQUESTS: 1000,
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
    },
    TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
  },

  // TCGPlayer API
  TCGPLAYER: {
    BASE_URL: process.env.TCGPLAYER_API_URL || 'https://api.tcgplayer.com',
    PUBLIC_KEY: process.env.TCGPLAYER_API_PUBLIC_KEY,
    PRIVATE_KEY: process.env.TCGPLAYER_API_PRIVATE_KEY,
    RATE_LIMIT: {
      MAX_REQUESTS: 1000,
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
    },
    TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    CATEGORY_ID: 3, // Pokemon TCG
  },

  // Cache Configuration
  CACHE: {
    CARD_TTL: 86400, // 24 hours
    PRICE_TTL: 3600, // 1 hour
    SET_TTL: 604800, // 7 days
    SEARCH_TTL: 3600, // 1 hour
    POPULAR_CARDS_COUNT: 100,
  },

  // Job Configuration
  JOBS: {
    PRICE_UPDATE: {
      SCHEDULE: '0 2 * * 0', // Every Sunday at 2 AM
      BATCH_SIZE: 250,
      RETRY_ATTEMPTS: 5,
      RETRY_DELAY: 5000,
    },
    SET_IMPORT: {
      BATCH_SIZE: 50,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 10000,
    },
    CARD_SYNC: {
      SCHEDULE: '0 3 * * *', // Every day at 3 AM
      RETRY_ATTEMPTS: 4,
      RETRY_DELAY: 3000,
    },
    DATA_CLEANUP: {
      SCHEDULE: '0 4 1 * *', // First day of month at 4 AM
      RETENTION_DAYS: 90,
      RETRY_ATTEMPTS: 2,
      RETRY_DELAY: 60000,
    },
    REPORT: {
      SCHEDULE: '0 9 * * 1', // Every Monday at 9 AM
    },
  },

  // Monitoring Configuration
  MONITORING: {
    METRICS_WINDOW_MS: 60 * 60 * 1000, // 1 hour
    HEALTH_CHECK_TIMEOUT: 5000, // 5 seconds
    ERROR_THRESHOLD: 0.1, // 10% error rate threshold
    RESPONSE_TIME_THRESHOLD: 2000, // 2 seconds
  },

  // Rate Limiting Configuration
  RATE_LIMITING: {
    QUEUE_CONCURRENCY: 5,
    PRIORITY_LEVELS: {
      CRITICAL: -20,
      HIGH: -10,
      NORMAL: 0,
      LOW: 10,
    },
  },
};

// Validation function to ensure all required config is present
export function validateConfiguration(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required');
  }

  if (!process.env.CLERK_SECRET_KEY) {
    errors.push('CLERK_SECRET_KEY is required');
  }

  // Optional but recommended
  if (!process.env.POKEMON_TCG_API_KEY) {
    warnings.push('POKEMON_TCG_API_KEY not set - API rate limits will be more restrictive');
  }

  if (!process.env.TCGPLAYER_API_PUBLIC_KEY || !process.env.TCGPLAYER_API_PRIVATE_KEY) {
    warnings.push('TCGPlayer API keys not set - pricing features will be disabled');
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    warnings.push('Redis/KV credentials not set - caching and job queues will be disabled');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}