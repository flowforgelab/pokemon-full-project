// Central export for all performance optimization utilities

// Server-side exports only (safe for API routes)
export * from './database-optimizer';
export * from './cache-manager';
export * from './api-optimizer';
export * from './monitoring';
export * from './scalability';

// Re-export only server-safe utilities from frontend-optimizer
export { 
  PerformanceCollector, 
  performanceCollector,
  prefetchComponentData,
  analyzeBundle 
} from './performance-utils';

// Note: Client-side utilities should be imported from:
// - './frontend-optimizer-client' for React components/hooks
// - './service-worker-manager' for service worker utilities
// - './image-optimizer' for image optimization utilities

// Performance configuration
export const performanceConfig = {
  // Cache TTLs (in seconds)
  cache: {
    cards: 86400,        // 24 hours
    search: 3600,        // 1 hour
    prices: 3600,        // 1 hour
    sets: 604800,        // 7 days
    user: 300,           // 5 minutes
    api: 1800,           // 30 minutes
  },
  
  // Image optimization
  images: {
    quality: 85,
    formats: ['webp', 'avif'],
    breakpoints: [640, 768, 1024, 1280, 1536],
    lazyLoadOffset: '50px',
  },
  
  // API optimization
  api: {
    rateLimit: {
      windowMs: 60 * 1000,      // 1 minute
      maxRequests: 100,         // per window
    },
    compression: true,
    etags: true,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      credentials: true,
    },
  },
  
  // Database optimization
  database: {
    connectionPool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
    },
    slowQueryThreshold: 100,    // ms
    queryTimeout: 30000,        // ms
  },
  
  // Performance budgets
  budgets: {
    bundles: {
      main: 250 * 1024,         // 250KB
      vendor: 500 * 1024,       // 500KB
    },
    metrics: {
      lcp: 2500,                // 2.5s
      fid: 100,                 // 100ms
      cls: 0.1,                 // 0.1
      ttfb: 800,                // 800ms
    },
  },
  
  // Monitoring
  monitoring: {
    enabled: process.env.NODE_ENV === 'production',
    sampleRate: 0.1,            // 10% of requests
    errorThreshold: 0.01,       // 1% error rate
  },
  
  // Scalability
  scalability: {
    autoScaling: {
      enabled: process.env.NODE_ENV === 'production',
      minInstances: 1,
      maxInstances: 10,
      targetCPU: 70,
      scaleUpThreshold: 80,
      scaleDownThreshold: 20,
      cooldownPeriod: 300,      // 5 minutes
    },
  },
};

// Initialize performance optimizations
export async function initializePerformance(): Promise<void> {
  if (typeof window !== 'undefined') {
    // Client-side initializations
    const { performanceMonitor } = await import('./monitoring');
    const { serviceWorkerManager } = await import('./service-worker-manager');
    const { ImageLazyLoader } = await import('./image-optimizer');
    
    // Start monitoring
    performanceMonitor; // Auto-initializes
    
    // Register service worker
    await serviceWorkerManager.register();
    
    // Initialize lazy loading
    ImageLazyLoader.initialize();
    
    // Log performance metrics
    if (performanceConfig.monitoring.enabled) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const metrics = performanceMonitor.getMetricsSummary();
          console.log('Performance Metrics:', metrics);
        }, 3000);
      });
    }
  } else {
    // Server-side initializations
    const { databaseOptimizer } = await import('./database-optimizer');
    const { cacheManager } = await import('./cache-manager');
    
    // Warm up caches
    if (process.env.NODE_ENV === 'production') {
      const { CacheWarmer } = await import('./api-optimizer');
      await CacheWarmer.warmPopularCards();
    }
    
    // Create database indexes if needed
    if (process.env.RUN_MIGRATIONS === 'true') {
      await databaseOptimizer.createCollectionStatsView();
    }
    
    // Start health monitoring
    setInterval(async () => {
      const health = await databaseOptimizer.performHealthCheck();
      if (!health.isHealthy) {
        console.error('Database health check failed:', health.issues);
      }
    }, 60000); // Every minute
  }
}