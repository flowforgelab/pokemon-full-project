import { NextRequest, NextResponse } from 'next/server';
import { getRedisPool } from '@/lib/redis/connection-pool';
import { logger } from '@/lib/logger';

// Health check endpoint for Redis connection pool
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const pool = getRedisPool();
    
    // Get connection stats
    const stats = pool.getStats();
    
    // Perform health check
    const isHealthy = await pool.healthCheck();
    
    // Get detailed queue information
    const queueDetails: Record<string, any> = {};
    const queueNames = ['ai-analysis', 'price-updates', 'card-sync'];
    
    for (const name of queueNames) {
      try {
        const queue = await pool.getQueue(name);
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount?.() || 0,
          queue.getActiveCount?.() || 0,
          queue.getCompletedCount?.() || 0,
          queue.getFailedCount?.() || 0,
        ]);
        
        queueDetails[name] = {
          waiting,
          active,
          completed,
          failed,
          total: waiting + active + completed + failed
        };
      } catch (error) {
        queueDetails[name] = { error: 'Failed to get queue stats' };
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? 'Redis connection pool healthy' : 'Redis connection pool unhealthy',
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      connectionPool: {
        ...stats,
        isHealthy
      },
      queues: queueDetails,
      redis: {
        url: process.env.REDIS_URL ? 'configured' : 'not configured',
        kvUrl: process.env.KV_URL ? 'configured' : 'not configured',
      },
      recommendations: [] as string[]
    };
    
    // Add recommendations based on stats
    if (stats.errors > 10) {
      response.recommendations.push('High error count detected. Check Redis connection stability.');
    }
    
    if (stats.active > 50) {
      response.recommendations.push('High number of active connections. Consider increasing connection limits.');
    }
    
    if (!isHealthy) {
      response.recommendations.push('Redis health check failed. Check connection and credentials.');
    }
    
    // Check for Upstash rate limit issues
    if (stats.lastError?.includes('max requests limit')) {
      response.recommendations.push('Upstash rate limit detected. Connection pooling is critical.');
    }
    
    logger.info('Redis health check completed', response);
    
    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Redis health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendations: [
        'Redis connection pool may not be initialized',
        'Check environment variables and Redis availability'
      ]
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}