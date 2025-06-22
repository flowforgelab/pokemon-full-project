// Frontend optimizer exports
// This file conditionally exports client-side or server-side utilities

// Re-export server-safe utilities
export { 
  PerformanceCollector, 
  performanceCollector,
  prefetchComponentData,
  analyzeBundle 
} from './performance-utils';

// Client-only exports (these will throw errors if imported on server)
// Use dynamic imports or conditional checks when using these
export type {
  useMemoCompare,
  useDebouncedCallback,
  useThrottledCallback,
  useVirtualList,
  withLazyLoading,
  withPerformanceMonitoring,
  OptimizedImage
} from './frontend-optimizer.client';