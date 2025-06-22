'use client';

import React, { useEffect, useState } from 'react';
import { performanceMonitor, cacheManager } from '@/lib/performance';

interface PerformanceMetrics {
  webVitals: Record<string, any>;
  cacheStats: {
    memory: any;
    redis: any;
    combined: any;
  };
  apiMetrics: Record<string, any>;
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;

    const updateMetrics = async () => {
      const webVitals = performanceMonitor.getMetricsSummary();
      const cacheStats = await cacheManager.stats();
      const apiMetrics = performanceMonitor.getMetricsSummary();

      setMetrics({
        webVitals,
        cacheStats,
        apiMetrics,
      });
    };

    // Initial load
    updateMetrics();

    // Update every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!metrics || process.env.NODE_ENV !== 'development') return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        title="Toggle Performance Dashboard"
      >
        📊
      </button>

      {/* Dashboard */}
      {isVisible && (
        <div className="fixed bottom-16 left-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96 max-h-[500px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Performance Dashboard</h3>

          {/* Web Vitals */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Web Vitals</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(metrics.webVitals).map(([metric, data]) => (
                <div key={metric} className="flex justify-between">
                  <span>{metric}:</span>
                  <span className={getMetricColor(metric, data.average)}>
                    {data.average?.toFixed(2)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cache Stats */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Cache Performance</h4>
            <div className="space-y-2 text-sm">
              <div>
                <div className="flex justify-between">
                  <span>Memory Hit Rate:</span>
                  <span>{(metrics.cacheStats.memory.hitRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Redis Hit Rate:</span>
                  <span>{(metrics.cacheStats.redis.hitRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Combined Hit Rate:</span>
                  <span className="font-medium">
                    {(metrics.cacheStats.combined.hitRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* API Metrics */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">API Performance</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(metrics.apiMetrics)
                .filter(([key]) => key.startsWith('api-'))
                .map(([endpoint, data]) => (
                  <div key={endpoint} className="flex justify-between">
                    <span>{endpoint.replace('api-', '')}:</span>
                    <span>{data.average?.toFixed(0)}ms</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Cache Size */}
          <div className="text-xs text-gray-500 mt-4">
            Cache Entries: {metrics.cacheStats.combined.entries} | 
            Size: {formatBytes(metrics.cacheStats.combined.size)}
          </div>
        </div>
      )}
    </>
  );
}

function getMetricColor(metric: string, value: number): string {
  const thresholds: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    TTFB: { good: 800, poor: 1800 },
  };

  const threshold = thresholds[metric];
  if (!threshold) return '';

  if (value <= threshold.good) return 'text-green-600';
  if (value <= threshold.poor) return 'text-yellow-600';
  return 'text-red-600';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}