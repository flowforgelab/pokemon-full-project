import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/lib/db';

const testDeckSchema = z.object({
  numberOfHands: z.number().min(1).max(100).default(10),
});

export async function POST(
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

    // Parse request body
    const body = await request.json();
    const validation = testDeckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { numberOfHands } = validation.data;

    // Load deck composition
    const composition = await deckBuilderManager.loadDeck(
      params.deckId,
      user.id
    );

    // Test deck
    const testingSession = await deckBuilderManager.testDeck(
      composition,
      numberOfHands
    );

    return NextResponse.json({
      testingSession,
    });
  } catch (error: any) {
    console.error('Error testing deck:', error);
    
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
      { error: 'Failed to test deck' },
      { status: 500 }
    );
  }
}