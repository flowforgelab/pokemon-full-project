# Redis Connection Pool Implementation

## Overview
This implementation addresses the Upstash Redis rate limit issue (500k requests) by implementing a connection pool that reuses connections and queues instead of creating new ones for each request.

## Key Changes

### 1. Connection Pool Manager (`connection-pool.ts`)
- Singleton pattern ensures only one pool instance exists
- Caches Queue, Worker, and QueueEvents instances
- Reuses Redis connections across requests
- Provides health check and statistics monitoring
- Handles connection cleanup on shutdown

### 2. Queue Updates (`queue.ts`)
- Updated to use connection pool for queue creation
- Falls back to direct creation if pool unavailable
- Maintains backward compatibility with existing code

### 3. AI Analysis Polling Optimization
- Changed polling interval from 2s to 5s
- Implemented exponential backoff (up to 30s)
- Added maximum polling attempts (60 = 5 minutes)
- Shows polling progress to users

### 4. API Route Updates
- `/api/analysis/ai/route.ts` - Uses pooled queue for job creation
- `/api/analysis/ai/status/[jobId]/route.ts` - Uses pooled queue for status checks
- Both routes now reuse connections instead of creating new ones

### 5. Health Monitoring
- New endpoint: `/api/health/redis`
- Shows connection pool statistics
- Displays queue statistics (waiting, active, completed, failed)
- Provides recommendations for issues
- Detects Upstash rate limit errors

## Usage

### Getting Queue Instance
```typescript
import { getRedisPool } from '@/lib/redis/connection-pool';

const pool = getRedisPool();
const queue = await pool.getQueue('ai-analysis');
```

### Health Check
```bash
curl http://localhost:3000/api/health/redis
```

## Configuration

### Environment Variables
- `REDIS_URL` - Redis connection URL (required)
- `BUILDING` - Set to 'true' during build to use mock queues

### Connection Limits
- Max connections: 10 (configurable)
- Connection timeout: 30 seconds
- Max retries per request: 3

## Benefits
1. **Reduced Redis Operations**: Connection reuse dramatically reduces requests
2. **Better Performance**: No connection overhead for each operation
3. **Resource Efficiency**: Limited connection pool prevents resource exhaustion
4. **Monitoring**: Built-in statistics and health checks
5. **Graceful Degradation**: Falls back to direct connections if pool fails

## Monitoring

The health endpoint provides:
- Connection pool statistics (created, active, idle, errors)
- Queue statistics for each queue
- Health status and recommendations
- Response time metrics

## Error Handling
- Automatic retry with exponential backoff
- Graceful fallback for connection failures
- Detailed error logging
- User-friendly error messages

## Expected Impact
- Redis requests reduced by ~90%
- No more Upstash rate limit errors
- Improved application stability
- Better performance under load