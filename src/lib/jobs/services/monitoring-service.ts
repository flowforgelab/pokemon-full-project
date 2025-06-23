import { prisma } from '@/server/db/prisma';
import { redisCache } from '@/server/db/redis';
import { checkRedisConnection, getAllQueueStats } from '../queues';
import { SystemHealth, ServiceHealth, SystemMetrics, Alert } from '../types';
import { pokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import * as os from 'os';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime: number;
  details: Record<string, any>;
  metrics: HealthMetrics;
}

export interface HealthMetrics {
  uptime: number;
  errorRate: number;
  averageResponseTime: number;
  throughput: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export class MonitoringService {
  private healthCheckInterval: NodeJS.Timer | null = null;
  private metricsInterval: NodeJS.Timer | null = null;
  private healthHistory: Map<string, HealthCheck[]> = new Map();

  /**
   * Start monitoring
   */
  async startMonitoring() {
    // Run health checks every minute
    this.healthCheckInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, 60000);

    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 30000);

    // Run initial checks
    await this.runHealthChecks();
    await this.collectSystemMetrics();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthCheck[]> {
    const checks = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkJobQueueHealth(),
      this.checkExternalAPIHealth('pokemon-tcg'),
      this.checkExternalAPIHealth('tcgplayer'),
      this.checkStorageHealth(),
    ]);

    // Store health checks
    const timestamp = new Date();
    await this.storeHealthChecks(checks, timestamp);

    // Check for alerts
    await this.checkForAlerts(checks);

    return checks;
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    const service = 'database';
    
    try {
      // Simple query to check connection
      const result = await prisma.$queryRaw`SELECT 1 as ping`;
      const responseTime = Date.now() - startTime;

      // Get connection pool stats
      const poolStats = await prisma.$queryRaw<any[]>`
        SELECT count(*) as connections,
               count(*) FILTER (WHERE state = 'active') as active,
               count(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      // Get database size
      const sizeResult = await prisma.$queryRaw<any[]>`
        SELECT pg_database_size(current_database()) as size
      `;

      // Get slow query count
      const slowQueries = await prisma.$queryRaw<any[]>`
        SELECT count(*) as count
        FROM pg_stat_statements
        WHERE mean_exec_time > 1000
      `.catch(() => [{ count: 0 }]);

      const status = responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy';

      return {
        service,
        status,
        lastChecked: new Date(),
        responseTime,
        details: {
          connections: poolStats[0]?.connections || 0,
          activeConnections: poolStats[0]?.active || 0,
          idleConnections: poolStats[0]?.idle || 0,
          databaseSize: sizeResult[0]?.size || 0,
          slowQueries: slowQueries[0]?.count || 0,
        },
        metrics: await this.getServiceMetrics(service),
      };

    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: await this.getServiceMetrics(service),
      };
    }
  }

  /**
   * Check Redis health
   */
  async checkRedisHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    const service = 'redis';

    try {
      const isConnected = await checkRedisConnection();
      const responseTime = Date.now() - startTime;

      if (!isConnected) {
        throw new Error('Redis connection failed');
      }

      // Get Redis info
      const info = await redisCache.info();
      const memory = await redisCache.memoryUsage();

      return {
        service,
        status: 'healthy',
        lastChecked: new Date(),
        responseTime,
        details: {
          connected: true,
          memoryUsage: memory,
          keyCount: await redisCache.dbSize(),
          info,
        },
        metrics: await this.getServiceMetrics(service),
      };

    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: await this.getServiceMetrics(service),
      };
    }
  }

  /**
   * Check job queue health
   */
  async checkJobQueueHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    const service = 'job-queue';

    try {
      const queueStats = await getAllQueueStats();
      const responseTime = Date.now() - startTime;

      // Calculate overall health
      let totalActive = 0;
      let totalFailed = 0;
      let totalWaiting = 0;

      for (const queue of Object.values(queueStats)) {
        totalActive += queue.counts.active;
        totalFailed += queue.counts.failed;
        totalWaiting += queue.counts.waiting;
      }

      const failureRate = totalFailed / (totalActive + totalFailed + totalWaiting) || 0;
      const status = failureRate < 0.05 ? 'healthy' : failureRate < 0.15 ? 'degraded' : 'unhealthy';

      return {
        service,
        status,
        lastChecked: new Date(),
        responseTime,
        details: {
          queues: queueStats,
          totalActive,
          totalFailed,
          totalWaiting,
          failureRate,
        },
        metrics: await this.getServiceMetrics(service),
      };

    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: await this.getServiceMetrics(service),
      };
    }
  }

  /**
   * Check external API health
   */
  async checkExternalAPIHealth(apiName: string): Promise<HealthCheck> {
    const startTime = Date.now();
    const service = `api-${apiName}`;

    try {
      let responseTime: number;
      let details: any = {};

      switch (apiName) {
        case 'pokemon-tcg':
          // Test Pokemon TCG API
          const sets = await pokemonTCGClient.sets.find('base1');
          responseTime = Date.now() - startTime;
          details = {
            endpoint: 'sets/base1',
            success: !!sets,
            rateLimit: pokemonTCGClient.getRateLimitStatus(),
          };
          break;

        case 'tcgplayer':
          // TCGPlayer pricing is now provided by Pokemon TCG API
          responseTime = Date.now() - startTime;
          details = {
            endpoint: 'integrated-pricing',
            success: true,
            note: 'Pricing data provided via Pokemon TCG API',
          };
          break;

        default:
          throw new Error(`Unknown API: ${apiName}`);
      }

      const status = responseTime < 500 ? 'healthy' : responseTime < 2000 ? 'degraded' : 'unhealthy';

      return {
        service,
        status,
        lastChecked: new Date(),
        responseTime,
        details,
        metrics: await this.getServiceMetrics(service),
      };

    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: await this.getServiceMetrics(service),
      };
    }
  }

  /**
   * Check storage health
   */
  async checkStorageHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    const service = 'storage';

    try {
      const diskSpace = await this.getDiskSpace();
      const responseTime = Date.now() - startTime;

      const usagePercent = (diskSpace.used / diskSpace.total) * 100;
      const status = usagePercent < 80 ? 'healthy' : usagePercent < 90 ? 'degraded' : 'unhealthy';

      return {
        service,
        status,
        lastChecked: new Date(),
        responseTime,
        details: {
          total: diskSpace.total,
          used: diskSpace.used,
          available: diskSpace.available,
          usagePercent,
        },
        metrics: await this.getServiceMetrics(service),
      };

    } catch (error) {
      return {
        service,
        status: 'unknown',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: await this.getServiceMetrics(service),
      };
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(timeRange?: TimeRange): Promise<SystemMetrics> {
    const cpuUsage = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get database metrics
    const dbMetrics = await this.getDatabaseMetrics();

    // Get job queue metrics
    const queueStats = await getAllQueueStats();
    let jobQueueMetrics = {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
    };

    for (const queue of Object.values(queueStats)) {
      jobQueueMetrics.active += queue.counts.active;
      jobQueueMetrics.waiting += queue.counts.waiting;
      jobQueueMetrics.completed += queue.counts.completed;
      jobQueueMetrics.failed += queue.counts.failed;
    }

    // Get disk usage
    const diskSpace = await this.getDiskSpace();

    return {
      cpu: {
        usage: cpuUsage[0] * 100, // 1 minute load average as percentage
        load: cpuUsage,
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      disk: {
        used: diskSpace.used,
        total: diskSpace.total,
        percentage: (diskSpace.used / diskSpace.total) * 100,
      },
      database: dbMetrics,
      jobQueue: jobQueueMetrics,
    };
  }

  /**
   * Send alert
   */
  async sendAlert(alert: Alert): Promise<void> {
    // Store alert in database
    await prisma.alert.create({
      data: {
        severity: alert.severity,
        type: alert.type,
        message: alert.message,
        metadata: alert.metadata,
      },
    });

    // Send notifications based on severity
    switch (alert.severity) {
      case 'critical':
        await this.sendCriticalAlert(alert);
        break;
      case 'warning':
        await this.sendWarningAlert(alert);
        break;
      case 'info':
        await this.sendInfoAlert(alert);
        break;
    }
  }

  // Private helper methods

  private async getServiceMetrics(service: string): Promise<HealthMetrics> {
    // Get historical metrics for the service
    const history = this.healthHistory.get(service) || [];
    const recentHistory = history.slice(-60); // Last hour

    if (recentHistory.length === 0) {
      return {
        uptime: 0,
        errorRate: 0,
        averageResponseTime: 0,
        throughput: 0,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          disk: 0,
        },
      };
    }

    const healthyCount = recentHistory.filter(h => h.status === 'healthy').length;
    const totalResponseTime = recentHistory.reduce((sum, h) => sum + h.responseTime, 0);

    return {
      uptime: (healthyCount / recentHistory.length) * 100,
      errorRate: ((recentHistory.length - healthyCount) / recentHistory.length) * 100,
      averageResponseTime: totalResponseTime / recentHistory.length,
      throughput: recentHistory.length,
      resourceUsage: {
        cpu: os.loadavg()[0] * 100,
        memory: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        disk: 0, // Would need to calculate based on service
      },
    };
  }

  private async getDatabaseMetrics() {
    try {
      const result = await prisma.$queryRaw<any[]>`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as connections,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active_queries,
          (SELECT avg(mean_exec_time) FROM pg_stat_statements WHERE calls > 10) as avg_query_time
      `;

      return {
        connections: result[0]?.connections || 0,
        activeQueries: result[0]?.active_queries || 0,
        avgQueryTime: result[0]?.avg_query_time || 0,
      };
    } catch {
      return {
        connections: 0,
        activeQueries: 0,
        avgQueryTime: 0,
      };
    }
  }

  private async getDiskSpace(): Promise<{ total: number; used: number; available: number }> {
    // This is a simplified implementation
    // In production, you'd use a proper disk space library
    return {
      total: 100 * 1024 * 1024 * 1024, // 100GB
      used: 60 * 1024 * 1024 * 1024,   // 60GB
      available: 40 * 1024 * 1024 * 1024, // 40GB
    };
  }

  private async storeHealthChecks(checks: HealthCheck[], timestamp: Date) {
    for (const check of checks) {
      // Store in memory for metrics calculation
      if (!this.healthHistory.has(check.service)) {
        this.healthHistory.set(check.service, []);
      }
      
      const history = this.healthHistory.get(check.service)!;
      history.push(check);
      
      // Keep only last 24 hours
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filtered = history.filter(h => h.lastChecked > cutoff);
      this.healthHistory.set(check.service, filtered);

      // Store in Redis for persistence
      await redisCache.set(
        `health:${check.service}:${timestamp.getTime()}`,
        JSON.stringify(check),
        3600 // 1 hour TTL
      );
    }
  }

  private async checkForAlerts(checks: HealthCheck[]) {
    for (const check of checks) {
      // Check for unhealthy services
      if (check.status === 'unhealthy') {
        await this.sendAlert({
          id: `alert-${check.service}-${Date.now()}`,
          severity: 'critical',
          type: 'service-unhealthy',
          message: `Service ${check.service} is unhealthy`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          metadata: {
            service: check.service,
            details: check.details,
          },
        });
      }

      // Check for degraded services
      if (check.status === 'degraded') {
        await this.sendAlert({
          id: `alert-${check.service}-${Date.now()}`,
          severity: 'warning',
          type: 'service-degraded',
          message: `Service ${check.service} is degraded`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          metadata: {
            service: check.service,
            details: check.details,
          },
        });
      }

      // Service-specific alerts
      if (check.service === 'database' && check.details.slowQueries > 10) {
        await this.sendAlert({
          id: `alert-slow-queries-${Date.now()}`,
          severity: 'warning',
          type: 'performance',
          message: `High number of slow queries detected: ${check.details.slowQueries}`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          metadata: check.details,
        });
      }

      if (check.service === 'storage' && check.details.usagePercent > 90) {
        await this.sendAlert({
          id: `alert-storage-${Date.now()}`,
          severity: 'critical',
          type: 'resource',
          message: `Storage usage critical: ${check.details.usagePercent.toFixed(1)}%`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          metadata: check.details,
        });
      }
    }
  }

  private async collectSystemMetrics() {
    const metrics = await this.getSystemMetrics();
    
    // Store metrics
    await redisCache.set(
      `metrics:system:${Date.now()}`,
      JSON.stringify(metrics),
      3600 // 1 hour TTL
    );

    // Check for resource alerts
    if (metrics.cpu.usage > 80) {
      await this.sendAlert({
        id: `alert-cpu-${Date.now()}`,
        severity: 'warning',
        type: 'resource',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
        resolved: false,
        metadata: metrics.cpu,
      });
    }

    if (metrics.memory.percentage > 85) {
      await this.sendAlert({
        id: `alert-memory-${Date.now()}`,
        severity: 'warning',
        type: 'resource',
        message: `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
        resolved: false,
        metadata: metrics.memory,
      });
    }
  }

  private async sendCriticalAlert(alert: Alert) {
    console.error(`CRITICAL ALERT: ${alert.message}`);
    // TODO: Send email, SMS, Slack notification, PagerDuty, etc.
  }

  private async sendWarningAlert(alert: Alert) {
    console.warn(`WARNING ALERT: ${alert.message}`);
    // TODO: Send email, Slack notification
  }

  private async sendInfoAlert(alert: Alert) {
    console.info(`INFO ALERT: ${alert.message}`);
    // TODO: Log to monitoring system
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();