import { NextResponse } from 'next/server';
import { Redis } from 'ioredis';

// Health check endpoint for Redis connection
export async function GET() {
  const startTime = Date.now();
  
  // Check if Redis is configured
  const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL;
  
  if (!REDIS_URL) {
    return NextResponse.json({
      status: 'error',
      message: 'Redis not configured',
      details: {
        REDIS_URL: false,
        KV_URL: false,
      },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  let redis: Redis | null = null;
  
  try {
    // Parse connection options
    let connectionOptions: any = {};
    
    if (REDIS_URL.startsWith('redis://') || REDIS_URL.startsWith('rediss://')) {
      const url = new URL(REDIS_URL);
      connectionOptions = {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || process.env.KV_REST_API_TOKEN,
        username: url.username || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        commandTimeout: 2000,
      };
      
      if (REDIS_URL.startsWith('rediss://')) {
        connectionOptions.tls = {};
      }
    } else {
      // Vercel KV URL - cannot be used with ioredis directly
      return NextResponse.json({
        status: 'error',
        message: 'Vercel KV detected - use Upstash Redis URL for BullMQ compatibility',
        details: {
          connectionType: 'Vercel KV REST API',
          compatible: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    // Create Redis connection
    redis = new Redis(connectionOptions);
    
    // Test connection with ping
    const pingResult = await redis.ping();
    const responseTime = Date.now() - startTime;
    
    // Get Redis info
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:(\S+)/);
    const modeMatch = info.match(/redis_mode:(\S+)/);
    
    // Test basic operations
    const testKey = `health:check:${Date.now()}`;
    await redis.set(testKey, 'ok', 'EX', 10); // Expire in 10 seconds
    const testValue = await redis.get(testKey);
    await redis.del(testKey);
    
    // Get connection stats
    const [connectedClients, usedMemory] = await Promise.all([
      redis.info('clients').then(str => {
        const match = str.match(/connected_clients:(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }),
      redis.info('memory').then(str => {
        const match = str.match(/used_memory_human:(\S+)/);
        return match ? match[1] : 'unknown';
      }),
    ]);
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Redis connection successful',
      details: {
        ping: pingResult,
        responseTimeMs: responseTime,
        redisVersion: versionMatch ? versionMatch[1] : 'unknown',
        redisMode: modeMatch ? modeMatch[1] : 'unknown',
        connectedClients,
        usedMemory,
        testOperation: testValue === 'ok' ? 'passed' : 'failed',
        connectionUrl: REDIS_URL.replace(/:[^:@]+@/, ':****@'), // Hide password
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'error',
      message: 'Redis connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        responseTimeMs: responseTime,
        connectionUrl: REDIS_URL.replace(/:[^:@]+@/, ':****@'), // Hide password
      },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
    
  } finally {
    // Clean up connection
    if (redis) {
      await redis.quit();
    }
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}