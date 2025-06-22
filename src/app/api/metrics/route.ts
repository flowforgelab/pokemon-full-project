import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { metricsCollector } from '@/lib/api/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Require authentication for metrics endpoint
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you might want to implement proper role checking)
    // For now, we'll allow any authenticated user
    
    const searchParams = req.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24');
    const endpoint = searchParams.get('endpoint');
    const method = searchParams.get('method');
    
    const [aggregatedStats, cacheStats, rateLimitUsage] = await Promise.all([
      metricsCollector.getAggregatedStats(hours),
      metricsCollector.getCacheStats(),
      metricsCollector.getRateLimitUsage(),
    ]);
    
    let endpointMetrics;
    if (endpoint && method) {
      endpointMetrics = await metricsCollector.getEndpointMetrics(endpoint, method);
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      period: {
        hours,
        start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      aggregated: aggregatedStats,
      cache: cacheStats,
      rateLimits: rateLimitUsage,
      endpoint: endpointMetrics,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch metrics',
    }, { status: 500 });
  }
}