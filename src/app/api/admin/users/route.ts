import { NextRequest, NextResponse } from 'next/server';
import { protectedApiRoute } from '@/lib/auth/api-middleware';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
  subscriptionTier: z.string().optional(),
});

export const GET = protectedApiRoute(
  async (req: NextRequest, context: any) => {
    try {
      const url = new URL(req.url);
      const query = querySchema.parse({
        page: url.searchParams.get('page') || 1,
        limit: url.searchParams.get('limit') || 20,
        search: url.searchParams.get('search') || undefined,
        role: url.searchParams.get('role') || undefined,
        subscriptionTier: url.searchParams.get('subscriptionTier') || undefined,
      });

      const where: any = {};

      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: 'insensitive' } },
          { username: { contains: query.search, mode: 'insensitive' } },
          { displayName: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.subscriptionTier) {
        where.subscriptionTier = query.subscriptionTier;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            id: true,
            clerkUserId: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            subscriptionTier: true,
            subscriptionEnd: true,
            features: true,
            createdAt: true,
            lastActiveAt: true,
            _count: {
              select: {
                decks: true,
                collections: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      return NextResponse.json({
        users,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid query parameters', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }
  },
  {
    requiredRole: 'admin',
    requiredPermission: {
      resource: 'user',
      action: 'read',
    },
    rateLimit: {
      requests: 30,
      window: 60,
    },
  }
);