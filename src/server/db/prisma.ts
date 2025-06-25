import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  // During build time, if DATABASE_URL is not set, return a dummy client
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not found. Using dummy Prisma client for build.');
    // Return a proxy that throws helpful errors if actually used
    return new Proxy({} as PrismaClient, {
      get: (target, prop) => {
        // Allow certain methods during build
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return undefined;
        }
        if (prop === '$disconnect') {
          return async () => {};
        }
        // For any actual database operation, throw an error
        return () => {
          throw new Error(`Database operation attempted without DATABASE_URL. Please set DATABASE_URL in your environment variables.`);
        };
      }
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;