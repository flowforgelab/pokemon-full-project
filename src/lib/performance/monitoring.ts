import { performanceCollector } from './performance-utils';

// Core Web Vitals thresholds
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
};

// Performance metrics interface
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  metadata?: Record<string, any>;
}

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
      this.initializeWebVitals();
    }
  }
  
  // Initialize performance observers
  private initializeObservers(): void {
    // Navigation timing
    this.observeNavigationTiming();
    
    // Resource timing
    this.observeResourceTiming();
    
    // User timing (custom marks and measures)
    this.observeUserTiming();
    
    // Long tasks
    this.observeLongTasks();
  }
  
  // Initialize Web Vitals monitoring
  private initializeWebVitals(): void {
    if (typeof window === 'undefined') return;
    
    // Dynamic import for web-vitals library
    // TODO: Re-enable after fixing build issues
    // import('web-vitals').then(({ onCLS, onFID, onLCP, onTTFB, onFCP }) => {
    //   onCLS(metric => this.recordWebVital('CLS', metric));
    //   onFID(metric => this.recordWebVital('FID', metric));
    //   onLCP(metric => this.recordWebVital('LCP', metric));
    //   onTTFB(metric => this.recordWebVital('TTFB', metric));
    //   onFCP(metric => this.recordWebVital('FCP', metric));
    // });
  }
  
  // Record Web Vital metric
  private recordWebVital(name: string, metric: any): void {
    const rating = this.getRating(name, metric.value);
    
    const performanceMetric: PerformanceMetric = {
      name,
      value: metric.value,
      rating,
      timestamp: Date.now(),
      metadata: {
        id: metric.id,
        navigationType: metric.navigationType,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };
    
    this.recordMetric(performanceMetric);
    
    // Send to analytics if poor performance
    if (rating === 'poor') {
      this.sendToAnalytics(performanceMetric);
    }
  }
  
  // Get rating for metric value
  private getRating(
    name: string,
    value: number
  ): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS];
    
    if (!thresholds) return 'good';
    
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }
  
  // Observe navigation timing
  private observeNavigationTiming(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const nav = entry as PerformanceNavigationTiming;
          
          // Record various navigation metrics
          this.recordMetric({
            name: 'page-load',
            value: nav.loadEventEnd - nav.fetchStart,
            rating: this.getRating('page-load', nav.loadEventEnd - nav.fetchStart),
            timestamp: Date.now(),
            metadata: {
              dns: nav.domainLookupEnd - nav.domainLookupStart,
              tcp: nav.connectEnd - nav.connectStart,
              request: nav.responseStart - nav.requestStart,
              response: nav.responseEnd - nav.responseStart,
              dom: nav.domComplete - nav.domInteractive,
              url: nav.name,
            },
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['navigation'] });
    this.observers.set('navigation', observer);
  }
  
  // Observe resource timing
  private observeResourceTiming(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          
          // Track slow resources
          if (resource.duration > 1000) {
            this.recordMetric({
              name: 'slow-resource',
              value: resource.duration,
              rating: 'poor',
              timestamp: Date.now(),
              metadata: {
                url: resource.name,
                type: resource.initiatorType,
                size: resource.transferSize,
              },
            });
          }
        }
      }
    });
    
    observer.observe({ entryTypes: ['resource'] });
    this.observers.set('resource', observer);
  }
  
  // Observe user timing
  private observeUserTiming(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          this.recordMetric({
            name: `custom-${entry.name}`,
            value: entry.duration,
            rating: this.getRating('custom', entry.duration),
            timestamp: Date.now(),
            metadata: {
              startMark: entry.startTime,
            },
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    this.observers.set('measure', observer);
  }
  
  // Observe long tasks
  private observeLongTasks(): void {
    if (!('PerformanceObserver' in window) || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      return;
    }
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric({
          name: 'long-task',
          value: entry.duration,
          rating: 'poor',
          timestamp: Date.now(),
          metadata: {
            startTime: entry.startTime,
            attribution: (entry as any).attribution,
          },
        });
      }
    });
    
    observer.observe({ entryTypes: ['longtask'] });
    this.observers.set('longtask', observer);
  }
  
  // Record a metric
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
    
    // Also record in performance collector
    performanceCollector.recordMetric(metric.name, metric.value);
  }
  
  // Get metrics summary
  getMetricsSummary(): Record<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    ratings: Record<string, number>;
  }> {
    const summary: Record<string, any> = {};
    
    // Group metrics by name
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);
    
    // Calculate summary for each metric
    for (const [name, metrics] of Object.entries(grouped)) {
      const values = metrics.map(m => m.value).sort((a, b) => a - b);
      const ratings = metrics.reduce((acc, m) => {
        acc[m.rating] = (acc[m.rating] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      summary[name] = {
        count: metrics.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: values[0],
        max: values[values.length - 1],
        p95: values[Math.floor(values.length * 0.95)],
        ratings,
      };
    }
    
    return summary;
  }
  
  // Send metrics to analytics
  private sendToAnalytics(metric: PerformanceMetric): void {
    // In production, this would send to your analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'performance', {
          event_category: 'Web Vitals',
          event_label: metric.name,
          value: Math.round(metric.value),
          metric_rating: metric.rating,
          ...metric.metadata,
        });
      }
    }
  }
  
  // Custom timing methods
  startTiming(name: string): void {
    if (typeof window !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }
  
  endTiming(name: string): void {
    if (typeof window !== 'undefined') {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }
  }
  
  // Clean up observers
  destroy(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }
}

// API performance tracker
export class APIPerformanceTracker {
  private static requests = new Map<string, {
    startTime: number;
    url: string;
    method: string;
  }>();
  
  static trackRequest(requestId: string, url: string, method: string): void {
    this.requests.set(requestId, {
      startTime: performance.now(),
      url,
      method,
    });
  }
  
  static trackResponse(
    requestId: string,
    status: number,
    size?: number
  ): void {
    const request = this.requests.get(requestId);
    if (!request) return;
    
    const duration = performance.now() - request.startTime;
    this.requests.delete(requestId);
    
    // Record metric
    const monitor = PerformanceMonitor.getInstance();
    monitor.recordMetric({
      name: 'api-request',
      value: duration,
      rating: duration < 200 ? 'good' : duration < 1000 ? 'needs-improvement' : 'poor',
      timestamp: Date.now(),
      metadata: {
        url: request.url,
        method: request.method,
        status,
        size,
      },
    });
  }
}

// Performance budgets
export class PerformanceBudget {
  private static budgets = {
    'bundle-size': 500 * 1024, // 500KB
    'image-size': 100 * 1024,  // 100KB per image
    'api-response': 1000,       // 1s
    'page-load': 3000,          // 3s
    'interaction': 100,         // 100ms
  };
  
  static checkBudget(type: string, value: number): {
    withinBudget: boolean;
    percentage: number;
    exceeded: boolean;
  } {
    const budget = this.budgets[type as keyof typeof this.budgets];
    if (!budget) {
      return { withinBudget: true, percentage: 0, exceeded: false };
    }
    
    const percentage = (value / budget) * 100;
    
    return {
      withinBudget: value <= budget,
      percentage,
      exceeded: value > budget * 1.2, // 20% over budget
    };
  }
  
  static setBudget(type: string, value: number): void {
    this.budgets[type as keyof typeof this.budgets] = value;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();