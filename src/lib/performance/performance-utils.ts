// Server-side performance utilities (no React dependencies)

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

// Prefetch component data (server-safe version)
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

// Bundle size analyzer helper (server-safe)
export function analyzeBundle(): void {
  if (process.env.NODE_ENV === 'development') {
    // Dynamic import to avoid bundling in production
    import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
      console.log('Bundle analyzer available. Run build with ANALYZE=true');
    }).catch(() => {
      // Ignore if not available
    });
  }
}