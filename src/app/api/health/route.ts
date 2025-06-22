import { NextResponse } from 'next/server';
import { performHealthCheck } from '@/lib/api/monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const healthCheck = await performHealthCheck();
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    Object.values(healthCheck).forEach((check: any) => {
      if (check.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (check.status === 'degraded' && overallStatus !== 'unhealthy') {
        overallStatus = 'degraded';
      }
    });
    
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: healthCheck,
    }, { status: statusCode });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    }, { status: 503 });
  }
}