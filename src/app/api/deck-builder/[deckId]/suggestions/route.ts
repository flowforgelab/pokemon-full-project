import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Load deck composition
    const composition = await deckBuilderManager.loadDeck(
      params.deckId,
      user.id
    );

    // Get suggestions
    const suggestions = await deckBuilderManager.getSuggestions(
      composition,
      user.id
    );

    return NextResponse.json({
      suggestions,
    });
  } catch (error: any) {
    console.error('Error getting suggestions:', error);
    
    if (error.message === 'Deck not found') {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized access to deck') {
      return NextResponse.json(
        { error: 'Unauthorized access to deck' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}