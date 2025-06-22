import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

// Create a dummy Redis instance for build time
const createRedisClient = () => {
  if (!url || !token) {
    console.warn('Redis configuration missing. Please set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.');
    // Return a mock Redis client for build time
    return {
      get: async () => null,
      set: async () => 'OK',
      del: async () => 0,
      zadd: async () => 0,
      zrangebyscore: async () => [],
      zremrangebyscore: async () => 0,
      expire: async () => 0,
      hincrby: async () => 0,
      hgetall: async () => ({}),
      info: async () => '',
      zcard: async () => 0,
      ping: async () => 'PONG',
    } as any;
  }

  return new Redis({
    url,
    token,
  });
};

export const redis = createRedisClient();