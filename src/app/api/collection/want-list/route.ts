import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import { z } from 'zod';

// Want list item schema
const wantListItemSchema = z.object({
  cardId: z.string(),
  priority: z.number().min(1).max(10).default(5),
  maxPrice: z.number().min(0).optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  notes: z.string().max(500).optional(),
});

// GET /api/collection/want-list - Get want list
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse filters
    const searchParams = req.nextUrl.searchParams;
    const filters: any = {};

    const priority = searchParams.getAll('priority');
    if (priority.length > 0) {
      filters.priority = priority.map(p => parseInt(p));
    }

    const maxPrice = searchParams.get('maxPrice');
    if (maxPrice) {
      filters.maxPrice = parseFloat(maxPrice);
    }

    const sets = searchParams.getAll('sets');
    if (sets.length > 0) {
      filters.sets = sets;
    }

    // Get want list
    const manager = new CollectionManager();
    const wantList = await manager.getWantList(user.id, filters);

    return NextResponse.json(wantList);
  } catch (error) {
    console.error('Error getting want list:', error);
    return NextResponse.json(
      { error: 'Failed to get want list' },
      { status: 500 }
    );
  }
}

// POST /api/collection/want-list - Add to want list
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = wantListItemSchema.parse(body);

    // Add to want list
    const manager = new CollectionManager();
    const result = await manager.addToWantList(user.id, validated.cardId, validated);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error adding to want list:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to add to want list' },
      { status: 500 }
    );
  }
}

// DELETE /api/collection/want-list - Remove from want list
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { cardIds } = body;

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json(
        { error: 'Card IDs are required' },
        { status: 400 }
      );
    }

    // Remove from want list
    const result = await prisma.wantList.deleteMany({
      where: {
        userId: user.id,
        cardId: { in: cardIds },
      },
    });

    return NextResponse.json({ removed: result.count });
  } catch (error) {
    console.error('Error removing from want list:', error);
    return NextResponse.json(
      { error: 'Failed to remove from want list' },
      { status: 500 }
    );
  }
}