import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error('Redis configuration missing. Please set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.');
}

export const redis = new Redis({
  url,
  token,
});