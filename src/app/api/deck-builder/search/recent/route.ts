import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
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

    // Get recently viewed cards
    const recentCards = await deckBuilderManager.getRecentlyViewed(user.id);

    return NextResponse.json({
      cards: recentCards,
    });
  } catch (error) {
    console.error('Error getting recent cards:', error);
    return NextResponse.json(
      { error: 'Failed to get recent cards' },
      { status: 500 }
    );
  }
}