import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';

const popularCardsSchema = z.object({
  format: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');

    const validation = popularCardsSchema.safeParse({ format, limit });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Get popular cards
    const popularCards = await deckBuilderManager.getPopularCards(
      validation.data.format
    );

    return NextResponse.json({
      cards: popularCards.slice(0, validation.data.limit),
    });
  } catch (error) {
    console.error('Error getting popular cards:', error);
    return NextResponse.json(
      { error: 'Failed to get popular cards' },
      { status: 500 }
    );
  }
}