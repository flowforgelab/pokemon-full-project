import React, { ComponentType, ReactNode, Suspense, lazy, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';

// Performance optimization hooks and utilities

// Memo with deep comparison
export function useMemoCompare<T>(
  value: T,
  compare: (prev: T | undefined, next: T) => boolean
): T {
  const ref = useRef<T>();
  
  if (!compare(ref.current, value)) {
    ref.current = value;
  }
  
  return ref.current as T;
}

// Debounced callback
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps?: React.DependencyList
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    deps ? [...deps, delay] : [delay]
  ) as T;
}

// Throttled callback
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps?: React.DependencyList
): T {
  const lastRun = useRef(Date.now());
  
  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        callback(...args);
      }
    },
    deps ? [...deps, delay] : [delay]
  ) as T;
}

// Virtual list hook for large datasets
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);
  
  const visibleItems = useMemo(
    () => items.slice(visibleRange.start, visibleRange.end),
    [items, visibleRange]
  );
  
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
}

// Component optimization wrappers

// Lazy loading with error boundary
export function withLazyLoading<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ReactNode
): T {
  const LazyComponent = lazy(importFunc);
  
  return ((props: any) => (
    <ErrorBoundary>
      <Suspense fallback={fallback || <LoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  )) as T;
}

// Performance monitoring HOC
export function withPerformanceMonitoring<T extends ComponentType<any>>(
  Component: T,
  componentName: string
): T {
  return memo(((props: any) => {
    const renderStartTime = useRef(performance.now());
    
    useEffect(() => {
      const renderTime = performance.now() - renderStartTime.current;
      
      // Log to performance monitoring
      if (typeof window !== 'undefined' && window.performance) {
        performance.mark(`${componentName}-render-end`);
        performance.measure(
          `${componentName}-render`,
          `${componentName}-render-start`,
          `${componentName}-render-end`
        );
      }
      
      // Send to analytics if render time is high
      if (renderTime > 100) {
        console.warn(`Slow render detected: ${componentName} (${renderTime.toFixed(2)}ms)`);
      }
    });
    
    // Mark render start
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark(`${componentName}-render-start`);
    }
    
    return <Component {...props} />;
  }) as T);
}

// Image optimization component
export const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  className,
  sizes,
  quality = 85,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  className?: string;
  sizes?: string;
  quality?: number;
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { isIntersecting } = useIntersectionObserver(imgRef, {
    threshold: 0,
    rootMargin: '50px',
  });
  
  // Generate optimized URLs
  const optimizedSrc = useMemo(() => {
    if (src.startsWith('http')) {
      // Use image CDN if available
      const cdnUrl = process.env.NEXT_PUBLIC_IMAGE_CDN_URL;
      if (cdnUrl) {
        const params = new URLSearchParams({
          url: src,
          w: width?.toString() || 'auto',
          h: height?.toString() || 'auto',
          q: quality.toString(),
          f: 'webp',
        });
        return `${cdnUrl}?${params}`;
      }
    }
    return src;
  }, [src, width, height, quality]);
  
  // Load image when in viewport or priority
  useEffect(() => {
    if ((isIntersecting || priority) && !isLoaded && !error) {
      const img = new Image();
      img.src = optimizedSrc;
      img.onload = () => {
        setIsLoaded(true);
        onLoad?.();
      };
      img.onerror = () => {
        setError(true);
      };
    }
  }, [isIntersecting, priority, isLoaded, error, optimizedSrc, onLoad]);
  
  return (
    <div className={`relative ${className || ''}`} style={{ width, height }}>
      {/* Placeholder */}
      {!isLoaded && placeholder === 'blur' && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm"
        />
      )}
      
      {/* Main image */}
      <img
        ref={imgRef}
        src={isLoaded || priority ? optimizedSrc : undefined}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={`
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          transition-opacity duration-300
          ${className || ''}
        `}
        loading={priority ? 'eager' : 'lazy'}
      />
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>;
    }
    
    return this.props.children;
  }
}

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Prefetch component data
export async function prefetchComponentData(
  componentName: string,
  fetcher: () => Promise<any>
): Promise<void> {
  const cacheKey = `prefetch:${componentName}`;
  
  // Check if already cached
  if (typeof window !== 'undefined' && sessionStorage.getItem(cacheKey)) {
    return;
  }
  
  try {
    const data = await fetcher();
    
    // Store in session storage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    }
  } catch (error) {
    console.error(`Failed to prefetch data for ${componentName}:`, error);
  }
}

// Bundle size analyzer helper
export function analyzeBundle(): void {
  if (process.env.NODE_ENV === 'development') {
    import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
      console.log('Bundle analyzer available. Run build with ANALYZE=true');
    });
  }
}

// Performance metrics collector
export class PerformanceCollector {
  private static instance: PerformanceCollector;
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(): PerformanceCollector {
    if (!PerformanceCollector.instance) {
      PerformanceCollector.instance = new PerformanceCollector();
    }
    return PerformanceCollector.instance;
  }
  
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }
  
  getMetrics(name: string): {
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }
  
  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Export performance utilities
export const performanceCollector = PerformanceCollector.getInstance();