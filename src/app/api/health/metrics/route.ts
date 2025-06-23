import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from '@/lib/jobs/services/monitoring-service';
import { getAllQueueStats } from '@/lib/jobs/queues';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    
    // Get system metrics
    const systemMetrics = await monitoringService.getSystemMetrics();
    
    // Get job queue metrics
    const queueStats = await getAllQueueStats();
    
    // Get database metrics
    const dbMetrics = await getDatabaseMetrics();
    
    // Get application metrics
    const appMetrics = await getApplicationMetrics();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      jobQueues: queueStats,
      database: dbMetrics,
      application: appMetrics,
    };

    // Support Prometheus format if requested
    if (format === 'prometheus') {
      const prometheusMetrics = formatPrometheusMetrics(metrics);
      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    }

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Metrics collection failed:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to collect metrics',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

async function getDatabaseMetrics() {
  try {
    const results = await Promise.all([
      // Connection count
      prisma.$queryRaw`
        SELECT count(*) as total_connections,
               count(*) FILTER (WHERE state = 'active') as active_connections,
               count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `,
      
      // Table sizes
      prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `,
      
      // Query performance
      prisma.$queryRaw`
        SELECT 
          count(*) as total_queries,
          avg(mean_exec_time) as avg_query_time,
          max(mean_exec_time) as max_query_time,
          count(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries
        FROM pg_stat_statements
        WHERE calls > 10
      `.catch(() => ({ total_queries: 0, avg_query_time: 0, max_query_time: 0, slow_queries: 0 })),
    ]);

    const [connections, tableSizes, queryPerf] = results as any[];

    return {
      connections: connections[0] || {},
      tableSizes: tableSizes || [],
      queryPerformance: queryPerf[0] || {},
    };
  } catch (error) {
    console.error('Database metrics error:', error);
    return {
      error: 'Failed to collect database metrics',
    };
  }
}

async function getApplicationMetrics() {
  try {
    const [userCount, deckCount, cardCount, collectionValue] = await Promise.all([
      prisma.user.count(),
      prisma.deck.count(),
      prisma.card.count(),
      prisma.userCollection.aggregate({
        _sum: { quantity: true },
      }),
    ]);

    // Get activity metrics (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [newUsers, newDecks, apiCalls] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.deck.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.auditLog.count({ 
        where: { 
          createdAt: { gte: oneDayAgo },
          category: 'api',
        } 
      }),
    ]);

    return {
      totals: {
        users: userCount,
        decks: deckCount,
        cards: cardCount,
        collectionItems: collectionValue._sum.quantity || 0,
      },
      activity24h: {
        newUsers,
        newDecks,
        apiCalls,
      },
    };
  } catch (error) {
    console.error('Application metrics error:', error);
    return {
      error: 'Failed to collect application metrics',
    };
  }
}

function formatPrometheusMetrics(metrics: any): string {
  const lines: string[] = [];
  
  // System metrics
  lines.push('# HELP system_cpu_usage CPU usage percentage');
  lines.push('# TYPE system_cpu_usage gauge');
  lines.push(`system_cpu_usage ${metrics.system.cpu.usage}`);
  
  lines.push('# HELP system_memory_usage_bytes Memory usage in bytes');
  lines.push('# TYPE system_memory_usage_bytes gauge');
  lines.push(`system_memory_usage_bytes ${metrics.system.memory.used}`);
  
  lines.push('# HELP system_memory_total_bytes Total memory in bytes');
  lines.push('# TYPE system_memory_total_bytes gauge');
  lines.push(`system_memory_total_bytes ${metrics.system.memory.total}`);
  
  // Job queue metrics
  Object.entries(metrics.jobQueues).forEach(([queueName, stats]: any) => {
    lines.push(`# HELP job_queue_active_count Active jobs in ${queueName}`);
    lines.push(`# TYPE job_queue_active_count gauge`);
    lines.push(`job_queue_active_count{queue="${queueName}"} ${stats.counts.active}`);
    
    lines.push(`# HELP job_queue_waiting_count Waiting jobs in ${queueName}`);
    lines.push(`# TYPE job_queue_waiting_count gauge`);
    lines.push(`job_queue_waiting_count{queue="${queueName}"} ${stats.counts.waiting}`);
    
    lines.push(`# HELP job_queue_failed_count Failed jobs in ${queueName}`);
    lines.push(`# TYPE job_queue_failed_count gauge`);
    lines.push(`job_queue_failed_count{queue="${queueName}"} ${stats.counts.failed}`);
  });
  
  // Database metrics
  if (metrics.database.connections) {
    lines.push('# HELP database_connections_total Total database connections');
    lines.push('# TYPE database_connections_total gauge');
    lines.push(`database_connections_total ${metrics.database.connections.total_connections || 0}`);
    
    lines.push('# HELP database_connections_active Active database connections');
    lines.push('# TYPE database_connections_active gauge');
    lines.push(`database_connections_active ${metrics.database.connections.active_connections || 0}`);
  }
  
  // Application metrics
  if (metrics.application.totals) {
    lines.push('# HELP app_users_total Total number of users');
    lines.push('# TYPE app_users_total counter');
    lines.push(`app_users_total ${metrics.application.totals.users}`);
    
    lines.push('# HELP app_decks_total Total number of decks');
    lines.push('# TYPE app_decks_total counter');
    lines.push(`app_decks_total ${metrics.application.totals.decks}`);
  }
  
  return lines.join('\n');
}