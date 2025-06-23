import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from '@/lib/jobs/services/monitoring-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Run health checks
    const healthChecks = await monitoringService.runHealthChecks();
    
    // Get system metrics
    const systemMetrics = await monitoringService.getSystemMetrics();
    
    // Determine overall health status
    const unhealthyServices = healthChecks.filter(check => check.status === 'unhealthy');
    const degradedServices = healthChecks.filter(check => check.status === 'degraded');
    
    const overallStatus = unhealthyServices.length > 0 
      ? 'unhealthy' 
      : degradedServices.length > 0 
        ? 'degraded' 
        : 'healthy';

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: healthChecks.reduce((acc, check) => {
        acc[check.service] = {
          status: check.status,
          responseTime: check.responseTime,
          lastChecked: check.lastChecked,
        };
        return acc;
      }, {} as Record<string, any>),
      metrics: {
        cpu: systemMetrics.cpu,
        memory: systemMetrics.memory,
        disk: systemMetrics.disk,
      },
      summary: {
        healthy: healthChecks.filter(c => c.status === 'healthy').length,
        degraded: degradedServices.length,
        unhealthy: unhealthyServices.length,
        total: healthChecks.length,
      },
    };

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}