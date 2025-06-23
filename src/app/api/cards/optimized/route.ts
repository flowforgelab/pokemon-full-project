import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import { 
  optimizeAPIRoute, 
  databaseOptimizer,
  APIPerformanceTracker,
  CircuitBreaker,
  BatchRequestProcessor,
} from '@/lib/performance';

// Request validation schema
const searchSchema = z.object({
  text: z.string().optional(),
  types: z.array(z.string()).optional(),
  supertype: z.string().optional(),
  setId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

// Batch processor for card fetching
const cardBatchProcessor = new BatchRequestProcessor(
  async (cardIds: string[]) => {
    const cards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      include: {
        set: true,
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
    
    return new Map(cards.map(card => [card.id, card]));
  },
  { batchSize: 50, batchDelay: 50 }
);

// Main handler with all optimizations applied
const handler = async (req: NextRequest) => {
  const requestId = crypto.randomUUID();
  APIPerformanceTracker.trackRequest(requestId, req.url, 'POST');
  
  try {
    // Auth check with circuit breaker
    const { userId: clerkUserId } = await CircuitBreaker.execute(
      'clerk-auth',
      () => auth(),
      () => null
    );
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse and validate request
    const body = await req.json();
    const params = searchSchema.parse(body);
    
    // Get user with optimized query
    const user = await databaseOptimizer.executePreparedQuery<any>(
      'get-user-by-clerk-id',
      'SELECT * FROM "User" WHERE "clerk_user_id" = $1',
      [clerkUserId]
    );
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Build optimized search query
    const where = databaseOptimizer.createOptimizedCardSearch({
      text: params.text,
      types: params.types,
      supertype: params.supertype,
      setId: params.setId,
    });
    
    // Execute search with pagination
    const [cards, total] = await prisma.$transaction([
      prisma.card.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: [
          { createdAt: 'desc' },
          { name: 'asc' },
        ],
        include: {
          set: true,
          prices: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.card.count({ where }),
    ]);
    
    // Track performance
    APIPerformanceTracker.trackResponse(requestId, 200, JSON.stringify(cards).length);
    
    return NextResponse.json({
      cards,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    });
  } catch (error) {
    APIPerformanceTracker.trackResponse(requestId, 500);
    console.error('Card search error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

// Export with all optimizations
export const POST = optimizeAPIRoute(handler, {
  cache: {
    ttl: 3600, // 1 hour
    tags: ['cards', 'search'],
    staleWhileRevalidate: true,
  },
  compress: true,
  rateLimit: {
    requests: 100,
    window: 60,
  },
});

// GET endpoint for single card with batch processing
export const GET = optimizeAPIRoute(
  async (req: NextRequest) => {
    const cardId = req.nextUrl.searchParams.get('id');
    
    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID required' },
        { status: 400 }
      );
    }
    
    // Use batch processor for efficiency
    const card = await cardBatchProcessor.request(cardId);
    
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(card);
  },
  {
    cache: {
      ttl: 86400, // 24 hours
      tags: ['cards'],
    },
    compress: true,
  }
);