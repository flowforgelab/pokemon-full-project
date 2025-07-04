/**
 * Direct queue creation - bypasses all module caching issues
 * This ALWAYS creates a real BullMQ queue, never mock
 */

import { Queue } from 'bullmq';

export function createDirectQueue(queueName: string): Queue {
  console.log(`[Direct Queue] Creating queue: ${queueName}`);
  
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || '';
  
  if (!redisUrl) {
    throw new Error(`[Direct Queue] No Redis URL found for ${queueName}`);
  }
  
  console.log(`[Direct Queue] Using Redis URL: ${redisUrl.substring(0, 30)}...`);
  
  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || process.env.KV_REST_API_TOKEN,
    username: url.username || undefined,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  };
  
  const queue = new Queue(queueName, { connection });
  console.log(`[Direct Queue] Created ${queue.constructor.name} for ${queueName}`);
  
  return queue;
}