import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/lib/db';

const importDeckSchema = z.object({
  data: z.string(),
  format: z.enum(['text', 'json', 'ptcgo']),
  createNew: z.boolean().default(true),
  deckName: z.string().optional(),
});

export async function POST(request: NextRequest) {
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
    const validation = importDeckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { data, format, createNew, deckName } = validation.data;

    // Import deck
    const importResult = await deckBuilderManager.importDeck(
      data,
      format,
      user.id
    );

    if (!importResult.success) {
      return NextResponse.json(
        {
          success: false,
          errors: importResult.errors,
          warnings: importResult.warnings,
        },
        { status: 400 }
      );
    }

    // Create new deck if requested
    let deckId: string | null = null;
    if (createNew && importResult.cards.length > 0) {
      const { deck } = await deckBuilderManager.createNewDeck(
        user.id,
        deckName || 'Imported Deck',
      );
      
      deckId = deck.id;
      
      // TODO: Add imported cards to the deck
      // This would require extending the deck builder manager
    }

    return NextResponse.json({
      success: true,
      importResult,
      deckId,
    });
  } catch (error) {
    console.error('Error importing deck:', error);
    return NextResponse.json(
      { error: 'Failed to import deck' },
      { status: 500 }
    );
  }
}