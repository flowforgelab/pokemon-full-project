# Redis Connection Pooling Fix Plan

## Problem
The application is hitting Upstash's 500,000 request limit due to:
- AI analysis polling creates new connections every 2 seconds
- No connection reuse in BullMQ queues
- Multiple Redis clients without pooling

## Immediate Actions

### 1. Create Connection Pool Manager
```typescript
// /src/lib/redis/connection-pool.ts
class RedisConnectionPool {
  private static instance: RedisConnectionPool;
  private queues: Map<string, Queue>;
  private redis: Redis;
  
  private constructor() {
    this.queues = new Map();
    this.redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new RedisConnectionPool();
    }
    return this.instance;
  }
  
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }
}
```

### 2. Update Queue Usage
Replace all instances of:
```typescript
const queue = new Queue('ai-analysis', { connection: redis });
```

With:
```typescript
const pool = RedisConnectionPool.getInstance();
const queue = pool.getQueue('ai-analysis');
```

### 3. Optimize Polling
In `ai-analysis-client.tsx`:
- Change polling interval: 2s → 5s
- Add exponential backoff
- Stop after 5 minutes
- Clean up on unmount

### 4. Connection Limits
- Set max connections: 10
- Implement connection timeout: 30s
- Add retry logic with backoff

## Files to Update
1. `/src/lib/redis/connection-pool.ts` (new)
2. `/src/lib/jobs/queue.ts`
3. `/src/lib/jobs/queue-wrapper.ts`
4. `/src/components/analysis/ai-analysis-client.tsx`
5. `/src/app/api/analysis/ai/status/[jobId]/route.ts`
6. `/src/app/api/analysis/ai/route.ts`

## Testing
1. Monitor Redis connection count
2. Check request usage in Upstash dashboard
3. Verify AI analysis still works
4. Test worker processes

## Success Metrics
- Redis requests < 100k/day
- No connection errors
- AI analysis completes successfully
- Polling doesn't create new connections