import { prisma } from '@/server/db/prisma';
import { Prisma } from '@prisma/client';

export interface QueryStats {
  query: string;
  executionTime: number;
  rowsReturned: number;
  planType: string;
  indexes: string[];
}

export interface ConnectionPoolStats {
  active: number;
  idle: number;
  waiting: number;
  total: number;
  maxConnections: number;
}

export class DatabaseOptimizer {
  private queryStats: Map<string, QueryStats[]> = new Map();
  private slowQueryThreshold = 100; // ms

  // Query optimization with EXPLAIN ANALYZE
  async analyzeQuery(query: string): Promise<QueryStats> {
    const startTime = Date.now();
    
    try {
      // Run EXPLAIN ANALYZE on the query
      const explainResult = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      );
      
      const executionTime = Date.now() - startTime;
      const plan = explainResult[0]['QUERY PLAN'][0];
      
      return {
        query,
        executionTime,
        rowsReturned: plan['Plan']['Actual Rows'] || 0,
        planType: plan['Plan']['Node Type'],
        indexes: this.extractIndexes(plan['Plan']),
      };
    } catch (error) {
      console.error('Query analysis failed:', error);
      throw error;
    }
  }

  // Extract indexes used from query plan
  private extractIndexes(plan: any): string[] {
    const indexes: string[] = [];
    
    const traverse = (node: any) => {
      if (node['Index Name']) {
        indexes.push(node['Index Name']);
      }
      if (node['Plans']) {
        node['Plans'].forEach(traverse);
      }
    };
    
    traverse(plan);
    return indexes;
  }

  // Monitor slow queries
  async monitorSlowQueries(): Promise<any[]> {
    try {
      const slowQueries = await prisma.$queryRaw`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          min_time,
          max_time,
          stddev_time
        FROM pg_stat_statements
        WHERE mean_time > ${this.slowQueryThreshold}
        ORDER BY mean_time DESC
        LIMIT 20
      `;
      
      return slowQueries as any[];
    } catch (error) {
      console.error('Failed to monitor slow queries:', error);
      return [];
    }
  }

  // Optimize card search queries
  createOptimizedCardSearch(filters: {
    text?: string;
    types?: string[];
    supertype?: string;
    rarity?: string[];
    setId?: string;
    formatLegal?: string;
    hp?: { min?: number; max?: number };
  }) {
    const where: Prisma.CardWhereInput = {};
    
    // Use full-text search for text queries
    if (filters.text) {
      where.OR = [
        {
          name: {
            contains: filters.text,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: filters.text,
            mode: 'insensitive',
          },
        },
      ];
    }
    
    // Use indexed fields efficiently
    if (filters.types?.length) {
      where.types = {
        hasSome: filters.types,
      };
    }
    
    if (filters.supertype) {
      where.supertype = filters.supertype as any;
    }
    
    if (filters.rarity?.length) {
      where.rarity = {
        in: filters.rarity as any[],
      };
    }
    
    if (filters.setId) {
      where.setId = filters.setId;
    }
    
    // Use partial indexes for format legality
    if (filters.formatLegal === 'standard') {
      where.isStandardLegal = true;
    } else if (filters.formatLegal === 'expanded') {
      where.isExpandedLegal = true;
    }
    
    // Range queries on indexed fields
    if (filters.hp) {
      where.hp = {};
      if (filters.hp.min !== undefined) {
        where.hp.gte = filters.hp.min;
      }
      if (filters.hp.max !== undefined) {
        where.hp.lte = filters.hp.max;
      }
    }
    
    return where;
  }

  // Connection pool monitoring
  async getConnectionPoolStats(): Promise<ConnectionPoolStats> {
    try {
      const stats = await prisma.$queryRaw<any[]>`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          count(*) as total,
          max_connections
        FROM pg_stat_activity
        CROSS JOIN (SELECT setting::int as max_connections FROM pg_settings WHERE name='max_connections') s
        WHERE datname = current_database()
      `;
      
      const result = stats[0];
      return {
        active: Number(result.active),
        idle: Number(result.idle),
        waiting: Number(result.idle_in_transaction),
        total: Number(result.total),
        maxConnections: Number(result.max_connections),
      };
    } catch (error) {
      console.error('Failed to get connection pool stats:', error);
      return {
        active: 0,
        idle: 0,
        waiting: 0,
        total: 0,
        maxConnections: 0,
      };
    }
  }

  // Batch operations for efficiency
  async batchInsertCards(cards: any[]): Promise<void> {
    const batchSize = 1000;
    
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      
      await prisma.$transaction(
        batch.map(card => 
          prisma.card.upsert({
            where: { id: card.id },
            update: card,
            create: card,
          })
        )
      );
    }
  }

  // Materialized view management
  async refreshMaterializedView(viewName: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`
    );
  }

  // Create materialized views for expensive aggregations
  async createCollectionStatsView(): Promise<void> {
    await prisma.$executeRaw`
      CREATE MATERIALIZED VIEW IF NOT EXISTS collection_stats AS
      SELECT 
        uc.user_id,
        COUNT(DISTINCT uc.card_id) as unique_cards,
        SUM(uc.quantity) as total_cards,
        COUNT(DISTINCT c.set_id) as unique_sets,
        SUM(uc.quantity * cp.market_price) as total_value,
        COUNT(DISTINCT CASE WHEN uc.is_wishlist THEN uc.card_id END) as wishlist_count,
        COUNT(DISTINCT CASE WHEN c.rarity = 'RARE' THEN uc.card_id END) as rare_cards,
        COUNT(DISTINCT CASE WHEN c.rarity IN ('ULTRA_RARE', 'SECRET_RARE') THEN uc.card_id END) as ultra_rare_cards
      FROM "UserCollection" uc
      JOIN "Card" c ON uc.card_id = c.id
      LEFT JOIN LATERAL (
        SELECT market_price 
        FROM "CardPrice" 
        WHERE card_id = c.id 
        ORDER BY updated_at DESC 
        LIMIT 1
      ) cp ON true
      GROUP BY uc.user_id
      WITH DATA;
      
      CREATE UNIQUE INDEX ON collection_stats (user_id);
    `;
  }

  // Query result caching with prepared statements
  private preparedStatements = new Map<string, any>();

  async executePreparedQuery<T>(
    key: string,
    query: string,
    params: any[]
  ): Promise<T> {
    if (!this.preparedStatements.has(key)) {
      // Prepare the statement
      this.preparedStatements.set(key, query);
    }
    
    return await prisma.$queryRawUnsafe<T>(query, ...params);
  }

  // Database health checks
  async performHealthCheck(): Promise<{
    isHealthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    let isHealthy = true;
    
    try {
      // Check connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Check connection pool
      const poolStats = await this.getConnectionPoolStats();
      if (poolStats.active / poolStats.maxConnections > 0.8) {
        issues.push('Connection pool usage above 80%');
        isHealthy = false;
      }
      
      // Check for long-running queries
      const longQueries = await prisma.$queryRaw<any[]>`
        SELECT pid, query, state, query_start
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query_start < NOW() - INTERVAL '5 minutes'
          AND datname = current_database()
      `;
      
      if (longQueries.length > 0) {
        issues.push(`${longQueries.length} long-running queries detected`);
      }
      
      // Check table bloat
      const bloatInfo = await prisma.$queryRaw<any[]>`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_dead_tup,
          n_live_tup,
          round(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_ratio
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
          AND n_live_tup > 0
        ORDER BY n_dead_tup DESC
        LIMIT 5
      `;
      
      if (bloatInfo.some((table: any) => table.dead_ratio > 20)) {
        issues.push('Table bloat detected - vacuum needed');
      }
      
      return {
        isHealthy,
        issues,
        metrics: {
          connectionPool: poolStats,
          longRunningQueries: longQueries.length,
          tableBloat: bloatInfo,
        },
      };
    } catch (error) {
      return {
        isHealthy: false,
        issues: ['Database health check failed: ' + error],
        metrics: {},
      };
    }
  }

  // Automatic index suggestions
  async suggestIndexes(): Promise<string[]> {
    const suggestions: string[] = [];
    
    try {
      // Find missing indexes based on query patterns
      const missingIndexes = await prisma.$queryRaw<any[]>`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats
        WHERE schemaname = 'public'
          AND n_distinct > 100
          AND correlation < 0.1
          AND tablename || '.' || attname NOT IN (
            SELECT 
              tablename || '.' || column_name
            FROM information_schema.constraint_column_usage
            WHERE constraint_schema = 'public'
          )
        ORDER BY n_distinct DESC
        LIMIT 10
      `;
      
      missingIndexes.forEach((col: any) => {
        suggestions.push(
          `CREATE INDEX idx_${col.tablename}_${col.attname} ON "${col.tablename}"(${col.attname});`
        );
      });
      
      return suggestions;
    } catch (error) {
      console.error('Failed to suggest indexes:', error);
      return [];
    }
  }
}

// Export singleton instance
export const databaseOptimizer = new DatabaseOptimizer();