import { redis } from '@/lib/db/redis';
import type { ApiMetrics, HealthCheckResult } from './types';

export class MetricsCollector {
  private metricsKey = 'api-metrics:';
  private windowMs = 60 * 60 * 1000; // 1 hour window

  /**
   * Record an API call metric
   */
  async recordApiCall(metrics: ApiMetrics): Promise<void> {
    try {
      const timestamp = metrics.timestamp.getTime();
      const key = `${this.metricsKey}${metrics.endpoint}:${metrics.method}`;
      
      // Store metric in sorted set
      await redis.zadd(key, timestamp, JSON.stringify(metrics));
      
      // Expire old metrics
      const cutoff = timestamp - this.windowMs;
      await redis.zremrangebyscore(key, '-inf', cutoff.toString());
      
      // Set TTL on key
      await redis.expire(key, Math.ceil(this.windowMs / 1000));
      
      // Update aggregated stats
      await this.updateAggregatedStats(metrics);
    } catch (error) {
      console.error('Failed to record API metrics:', error);
    }
  }

  /**
   * Update aggregated statistics
   */
  private async updateAggregatedStats(metrics: ApiMetrics): Promise<void> {
    const hourKey = this.getHourKey(metrics.timestamp);
    const statsKey = `${this.metricsKey}stats:${hourKey}`;
    
    // Increment counters
    await redis.hincrby(statsKey, 'total_requests', 1);
    await redis.hincrby(statsKey, `status_${metrics.statusCode}`, 1);
    
    if (metrics.statusCode >= 400) {
      await redis.hincrby(statsKey, 'errors', 1);
    }
    
    // Update response time stats
    await redis.hincrby(statsKey, 'total_response_time', metrics.responseTime);
    
    // Expire after 24 hours
    await redis.expire(statsKey, 86400);
  }

  /**
   * Get metrics for a specific endpoint
   */
  async getEndpointMetrics(
    endpoint: string,
    method: string,
    minutes = 60
  ): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    statusCodes: Record<number, number>;
    recentErrors: ApiMetrics[];
  }> {
    const key = `${this.metricsKey}${endpoint}:${method}`;
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    // Get metrics within time window
    const metricsData = await redis.zrangebyscore(
      key,
      cutoff.toString(),
      '+inf'
    );
    
    const metrics = metricsData.map(data => JSON.parse(data) as ApiMetrics);
    
    // Calculate statistics
    const totalRequests = metrics.length;
    const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    const statusCodes: Record<number, number> = {};
    const errors: ApiMetrics[] = [];
    
    metrics.forEach(metric => {
      statusCodes[metric.statusCode] = (statusCodes[metric.statusCode] || 0) + 1;
      if (metric.statusCode >= 400) {
        errors.push(metric);
      }
    });
    
    const errorRate = totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0;
    
    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      statusCodes,
      recentErrors: errors.slice(-10), // Last 10 errors
    };
  }

  /**
   * Get aggregated statistics
   */
  async getAggregatedStats(hours = 24): Promise<{
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    hourlyStats: Array<{
      hour: string;
      requests: number;
      errors: number;
      avgResponseTime: number;
    }>;
  }> {
    const now = new Date();
    const hourlyStats = [];
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    
    for (let i = 0; i < hours; i++) {
      const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourKey = this.getHourKey(hour);
      const statsKey = `${this.metricsKey}stats:${hourKey}`;
      
      const stats = await redis.hgetall(statsKey);
      
      if (stats.total_requests) {
        const requests = parseInt(stats.total_requests);
        const errors = parseInt(stats.errors || '0');
        const responseTime = parseInt(stats.total_response_time || '0');
        
        totalRequests += requests;
        totalErrors += errors;
        totalResponseTime += responseTime;
        
        hourlyStats.push({
          hour: hourKey,
          requests,
          errors,
          avgResponseTime: requests > 0 ? responseTime / requests : 0,
        });
      }
    }
    
    return {
      totalRequests,
      totalErrors,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      hourlyStats: hourlyStats.reverse(),
    };
  }

  /**
   * Get cache hit ratio
   */
  async getCacheStats(): Promise<{
    hitRatio: number;
    totalHits: number;
    totalMisses: number;
  }> {
    try {
      const info = await redis.info('stats');
      
      // Parse Redis info to get keyspace stats
      let hits = 0;
      let misses = 0;
      
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.startsWith('keyspace_hits:')) {
          hits = parseInt(line.split(':')[1]);
        } else if (line.startsWith('keyspace_misses:')) {
          misses = parseInt(line.split(':')[1]);
        }
      });
      
      const total = hits + misses;
      const hitRatio = total > 0 ? (hits / total) * 100 : 0;
      
      return {
        hitRatio,
        totalHits: hits,
        totalMisses: misses,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        hitRatio: 0,
        totalHits: 0,
        totalMisses: 0,
      };
    }
  }

  /**
   * Get rate limit usage
   */
  async getRateLimitUsage(): Promise<Record<string, {
    used: number;
    limit: number;
    percentage: number;
  }>> {
    const apis = ['pokemon-tcg', 'tcgplayer'];
    const usage: Record<string, any> = {};
    
    for (const api of apis) {
      const key = `rate-limit:${api}:global`;
      const count = await redis.zcard(key);
      
      // Get configured limits (these should match your rate limiter config)
      const limits: Record<string, number> = {
        'pokemon-tcg': 1000,
        'tcgplayer': 1000,
      };
      
      const limit = limits[api] || 1000;
      usage[api] = {
        used: count,
        limit,
        percentage: (count / limit) * 100,
      };
    }
    
    return usage;
  }

  /**
   * Get hour key for aggregation
   */
  private getHourKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }
}

// Health check functions
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  try {
    const { prisma } = await import('@/lib/db/prisma');
    const startTime = Date.now();
    
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      service: 'database',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      message: `Response time: ${responseTime}ms`,
      details: { responseTime },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
      timestamp: new Date(),
    };
  }
}

export async function checkRedisHealth(): Promise<HealthCheckResult> {
  try {
    const startTime = Date.now();
    await redis.ping();
    const responseTime = Date.now() - startTime;
    
    return {
      service: 'redis',
      status: responseTime < 100 ? 'healthy' : 'degraded',
      message: `Response time: ${responseTime}ms`,
      details: { responseTime },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Redis connection failed',
      timestamp: new Date(),
    };
  }
}

export async function checkApiHealth(apiName: string, testEndpoint: string): Promise<HealthCheckResult> {
  try {
    const startTime = Date.now();
    const response = await fetch(testEndpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        service: apiName,
        status: 'degraded',
        message: `API returned ${response.status}`,
        details: { statusCode: response.status, responseTime },
        timestamp: new Date(),
      };
    }
    
    return {
      service: apiName,
      status: responseTime < 2000 ? 'healthy' : 'degraded',
      message: `Response time: ${responseTime}ms`,
      details: { responseTime },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      service: apiName,
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'API check failed',
      timestamp: new Date(),
    };
  }
}

export async function checkQueueHealth(): Promise<HealthCheckResult> {
  try {
    const { getAllQueuesStats } = await import('../jobs/queue');
    const stats = await getAllQueuesStats();
    
    let totalActive = 0;
    let totalFailed = 0;
    let totalWaiting = 0;
    
    Object.values(stats).forEach((queueStats: any) => {
      totalActive += queueStats.active || 0;
      totalFailed += queueStats.failed || 0;
      totalWaiting += queueStats.waiting || 0;
    });
    
    const status = totalFailed > 100 ? 'degraded' : 'healthy';
    
    return {
      service: 'queues',
      status,
      message: `Active: ${totalActive}, Waiting: ${totalWaiting}, Failed: ${totalFailed}`,
      details: stats,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      service: 'queues',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Queue check failed',
      timestamp: new Date(),
    };
  }
}

// Global metrics instance
export const metricsCollector = new MetricsCollector();

// Comprehensive health check
export async function performHealthCheck(): Promise<Record<string, HealthCheckResult>> {
  const [database, redisHealth, queues] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkQueueHealth(),
  ]);
  
  return {
    database,
    redis: redisHealth,
    queues,
    timestamp: new Date().toISOString(),
  };
}