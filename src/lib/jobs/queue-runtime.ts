/**
 * Runtime queue getter that ensures we never use MockQueue in production
 * Use this instead of importing from queue.ts directly
 */

import type { Queue } from 'bullmq';

let realQueueCache: Record<string, Queue> = {};

export async function getRuntimeQueue(queueName: string): Promise<Queue> {
  // Return cached queue if available
  if (realQueueCache[queueName]) {
    return realQueueCache[queueName];
  }

  // In production runtime, ALWAYS use real queue
  if (process.env.NODE_ENV === 'production' && process.env.BUILDING !== 'true') {
    console.log(`[Runtime Queue] Forcing real queue for ${queueName} in production`);
    
    const { Queue } = await import('bullmq');
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL || '';
    
    if (!redisUrl) {
      console.error('[Runtime Queue] No Redis URL found!');
      throw new Error('Redis URL required for queue operations');
    }
    
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || process.env.KV_REST_API_TOKEN,
      username: url.username || undefined,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    };
    
    const queue = new Queue(queueName, { connection });
    realQueueCache[queueName] = queue;
    return queue;
  }
  
  // Otherwise use the normal queue module
  const queueModule = await import('./queue');
  
  switch (queueName) {
    case 'ai-analysis':
      return queueModule.aiAnalysisQueue;
    case 'price-updates':
      return queueModule.priceUpdateQueue;
    case 'card-sync':
      return queueModule.cardSyncQueue;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }
}

// Convenience function for AI analysis queue
export function getAiAnalysisQueue(): Promise<Queue> {
  return getRuntimeQueue('ai-analysis');
}