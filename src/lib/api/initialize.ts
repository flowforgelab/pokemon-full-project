import { PokemonTCGClient } from './pokemon-tcg-client';
import { TCGPlayerClient } from './tcgplayer-client';
import { redis } from '@/lib/db/redis';
import { prisma } from '@/lib/db/prisma';
import { scheduleRecurringJobs } from '../jobs/queue';
import { startAllWorkers } from '../jobs/processors';
import { warmPopularCardsCache } from './cache';
import { performHealthCheck } from './monitoring';

interface InitializationResult {
  success: boolean;
  services: Record<string, {
    status: 'success' | 'failed';
    message?: string;
  }>;
  warnings: string[];
}

/**
 * Initialize all API services and background jobs
 */
export async function initializeServices(): Promise<InitializationResult> {
  console.log('🚀 Initializing Pokemon TCG Deck Builder services...');
  
  const result: InitializationResult = {
    success: true,
    services: {},
    warnings: [],
  };

  // 1. Test database connection
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    result.services.database = { status: 'success' };
    console.log('✅ Database connection established');
  } catch (error) {
    result.services.database = { 
      status: 'failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
    result.success = false;
    console.error('❌ Database connection failed:', error);
  }

  // 2. Test Redis connection
  try {
    await redis.ping();
    result.services.redis = { status: 'success' };
    console.log('✅ Redis connection established');
  } catch (error) {
    result.services.redis = { 
      status: 'failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
    result.warnings.push('Redis connection failed - caching will be disabled');
    console.error('⚠️  Redis connection failed:', error);
  }

  // 3. Test Pokemon TCG API
  try {
    const pokemonClient = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    const testResult = await pokemonClient.getSupertypes();
    
    if (testResult.error) {
      throw testResult.error;
    }
    
    result.services.pokemonTCG = { status: 'success' };
    console.log('✅ Pokemon TCG API connection established');
  } catch (error) {
    result.services.pokemonTCG = { 
      status: 'failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
    result.warnings.push('Pokemon TCG API connection failed - card data sync will be unavailable');
    console.error('⚠️  Pokemon TCG API connection failed:', error);
  }

  // 4. Test TCGPlayer API
  if (process.env.TCGPLAYER_API_PUBLIC_KEY && process.env.TCGPLAYER_API_PRIVATE_KEY) {
    try {
      const tcgPlayerClient = new TCGPlayerClient(
        process.env.TCGPLAYER_API_PUBLIC_KEY,
        process.env.TCGPLAYER_API_PRIVATE_KEY
      );
      
      const authResult = await tcgPlayerClient.authenticateAPI();
      
      if (authResult.error) {
        throw authResult.error;
      }
      
      result.services.tcgPlayer = { status: 'success' };
      console.log('✅ TCGPlayer API authentication successful');
    } catch (error) {
      result.services.tcgPlayer = { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      result.warnings.push('TCGPlayer API authentication failed - pricing data will be unavailable');
      console.error('⚠️  TCGPlayer API authentication failed:', error);
    }
  } else {
    result.services.tcgPlayer = { 
      status: 'failed', 
      message: 'API keys not configured' 
    };
    result.warnings.push('TCGPlayer API keys not configured - pricing features disabled');
  }

  // 5. Initialize background jobs (only if core services are available)
  if (result.services.database.status === 'success' && result.services.redis.status === 'success') {
    try {
      await scheduleRecurringJobs();
      startAllWorkers();
      result.services.backgroundJobs = { status: 'success' };
      console.log('✅ Background jobs initialized');
    } catch (error) {
      result.services.backgroundJobs = { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
      result.warnings.push('Background job initialization failed - automated updates disabled');
      console.error('⚠️  Background job initialization failed:', error);
    }
  } else {
    result.services.backgroundJobs = { 
      status: 'failed', 
      message: 'Required services not available' 
    };
    result.warnings.push('Background jobs disabled due to missing services');
  }

  // 6. Warm cache with popular cards (optional, non-critical)
  if (result.services.redis.status === 'success' && result.services.database.status === 'success') {
    try {
      // Get top 100 most used cards
      const popularCards = await prisma.card.findMany({
        where: {
          deckCards: {
            some: {}
          }
        },
        select: {
          id: true,
        },
        orderBy: {
          deckCards: {
            _count: 'desc'
          }
        },
        take: 100,
      });
      
      if (popularCards.length > 0) {
        await warmPopularCardsCache(popularCards.map(c => c.id));
        console.log(`✅ Warmed cache with ${popularCards.length} popular cards`);
      }
    } catch (error) {
      console.warn('⚠️  Cache warming failed:', error);
      result.warnings.push('Cache warming failed - initial requests may be slower');
    }
  }

  // 7. Validate configuration
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
  ];
  
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    result.warnings.push(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    result.success = false;
  }

  // Summary
  console.log('\n📊 Initialization Summary:');
  console.log(`Overall Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
  
  Object.entries(result.services).forEach(([service, status]) => {
    const icon = status.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${service}: ${status.status}${status.message ? ` - ${status.message}` : ''}`);
  });
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  return result;
}

/**
 * Gracefully shutdown all services
 */
export async function shutdownServices(): Promise<void> {
  console.log('🛑 Shutting down services...');
  
  try {
    // Stop all workers
    const { stopAllWorkers } = await import('../jobs/processors');
    await stopAllWorkers();
    console.log('✅ Background workers stopped');
  } catch (error) {
    console.error('❌ Error stopping workers:', error);
  }
  
  try {
    // Close database connection
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
  
  try {
    // Close Redis connection
    await redis.quit();
    console.log('✅ Redis connection closed');
  } catch (error) {
    console.error('❌ Error closing Redis:', error);
  }
  
  console.log('✅ Shutdown complete');
}

/**
 * Run startup checks and return system status
 */
export async function runStartupChecks(): Promise<{
  status: 'ready' | 'degraded' | 'failed';
  services: Record<string, any>;
  warnings: string[];
}> {
  const initResult = await initializeServices();
  const healthCheck = await performHealthCheck();
  
  // Determine overall status
  let status: 'ready' | 'degraded' | 'failed' = 'ready';
  
  if (!initResult.success) {
    status = 'failed';
  } else if (initResult.warnings.length > 0) {
    status = 'degraded';
  }
  
  return {
    status,
    services: {
      initialization: initResult.services,
      health: healthCheck,
    },
    warnings: initResult.warnings,
  };
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownServices();
  process.exit(0);
});