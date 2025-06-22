import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import { z } from 'zod';
import type { QuickAddItem } from '@/lib/collection/types';
import { CardCondition, AcquisitionSource, StorageLocation } from '@/lib/collection/types';

// Quick add schema
const quickAddSchema = z.object({
  items: z.array(z.object({
    cardName: z.string().min(1),
    setCode: z.string().optional(),
    quantity: z.number().int().min(1).max(999),
    condition: z.nativeEnum(CardCondition),
    purchasePrice: z.number().min(0).optional(),
    source: z.nativeEnum(AcquisitionSource),
    location: z.nativeEnum(StorageLocation),
    notes: z.string().max(500).optional(),
  })).min(1).max(100),
});

// POST /api/collection/quick-add - Quick add cards to collection
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
    const validated = quickAddSchema.parse(body);

    // Add cards to collection
    const manager = new CollectionManager();
    const result = await manager.quickAddCards(user.id, validated.items as QuickAddItem[]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error quick adding cards:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to add cards' },
      { status: 500 }
    );
  }
}

// GET /api/collection/quick-add/suggestions - Get card suggestions
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Get card suggestions
    const suggestions = await prisma.card.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: {
        set: {
          select: { name: true, code: true },
        },
      },
      take: limit,
      orderBy: [
        { rarity: 'desc' },
        { name: 'asc' },
      ],
    });

    const results = suggestions.map(card => ({
      id: card.id,
      name: card.name,
      setName: card.set.name,
      setCode: card.set.code,
      rarity: card.rarity,
      imageUrl: card.imageUrlSmall,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}