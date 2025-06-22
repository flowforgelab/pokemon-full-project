import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import type { AnalysisConfig } from '@/lib/analysis/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get deck with cards
    const deck = await prisma.deck.findUnique({
      where: { id: params.deckId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
        user: {
          select: {
            id: true,
            clerkUserId: true,
          },
        },
      },
    });

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    // Check if user owns the deck or deck is public
    if (!deck.isPublic && deck.user.clerkUserId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get analysis configuration from query params
    const searchParams = req.nextUrl.searchParams;
    const config: AnalysisConfig = {
      format: (searchParams.get('format') as 'standard' | 'expanded') || 'standard',
      includeRotation: searchParams.get('includeRotation') !== 'false',
    };

    // Perform analysis
    const analyzer = new DeckAnalyzer(config);
    const analysis = await analyzer.analyzeDeck(deck);

    return NextResponse.json({
      analysis,
      deck: {
        id: deck.id,
        name: deck.name,
        format: deck.formatId,
        type: deck.deckType,
      },
    });
  } catch (error) {
    console.error('Deck analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze deck' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This endpoint can be used to save analysis results or trigger background analysis
    const body = await req.json();
    
    // Verify deck ownership
    const deck = await prisma.deck.findUnique({
      where: { id: params.deckId },
      include: {
        user: {
          select: {
            clerkUserId: true,
          },
        },
      },
    });

    if (!deck || deck.user.clerkUserId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Could save analysis results, trigger notifications, etc.
    // For now, just return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analysis save error:', error);
    return NextResponse.json(
      { error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}