import { TRPCError } from '@trpc/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(options: RateLimitOptions) {
  return async (key: string) => {
    const now = Date.now();
    const record = store[key];

    if (!record || now > record.resetTime) {
      store[key] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      return;
    }

    if (record.count >= options.max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      });
    }

    record.count++;
  };
}

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
});