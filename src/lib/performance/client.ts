// Client-side performance utilities
// This file should only be imported in client components

export {
  // React hooks
  useMemoCompare,
  useDebouncedCallback,
  useThrottledCallback,
  useVirtualList,
  
  // HOCs and components
  withLazyLoading,
  withPerformanceMonitoring,
  OptimizedImage
} from './frontend-optimizer.client';

// Re-export client-safe utilities from other modules
export { serviceWorkerManager } from './service-worker-manager';
export { ImageLazyLoader } from './image-optimizer';

// Re-export monitoring utilities that are client-safe
export { performanceMonitor } from './monitoring';