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
      setex: async () => 'OK',
      del: async () => 0,
      exists: async () => 0,
      ttl: async () => -1,
      keys: async () => [],
      mget: async () => [],
      zadd: async () => 0,
      zrangebyscore: async () => [],
      zremrangebyscore: async () => 0,
      expire: async () => 0,
      hincrby: async () => 0,
      hgetall: async () => ({}),
      info: async () => '',
      zcard: async () => 0,
      ping: async () => 'PONG',
      connect: async () => {},
      disconnect: async () => {},
      on: () => {},
      off: () => {},
      once: () => {},
      emit: () => false,
    } as any;
  }

  return new Redis({
    url,
    token,
  });
};

export const redis = createRedisClient();

// Cache helper functions
export const redisCache = redis;

export const getCardCache = async (key: string) => {
  try {
    return await redis.get(key);
  } catch (error) {
    console.error('Error getting card cache:', error);
    return null;
  }
};

export const getAnalysisCache = async (key: string) => {
  try {
    return await redis.get(`analysis:${key}`);
  } catch (error) {
    console.error('Error getting analysis cache:', error);
    return null;
  }
};

export const getCollectionCache = async (key: string) => {
  try {
    return await redis.get(`collection:${key}`);
  } catch (error) {
    console.error('Error getting collection cache:', error);
    return null;
  }
};

export const getPriceCache = async (key: string) => {
  try {
    return await redis.get(`price:${key}`);
  } catch (error) {
    console.error('Error getting price cache:', error);
    return null;
  }
};