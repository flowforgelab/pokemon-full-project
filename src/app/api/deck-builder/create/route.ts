import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/server/db/prisma';

const createDeckSchema = z.object({
  name: z.string().min(1).max(100),
  formatId: z.string().optional(),
  template: z.string().optional(),
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
    const validation = createDeckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, formatId, template } = validation.data;

    // Get format if specified
    let format;
    if (formatId) {
      format = await prisma.format.findUnique({
        where: { id: formatId },
      });
    }

    // Create new deck
    const { deck, composition } = await deckBuilderManager.createNewDeck(
      user.id,
      name,
      format,
      template
    );

    return NextResponse.json({
      deck: {
        id: deck.id,
        name: deck.name,
        formatId: deck.formatId,
      },
      composition,
    });
  } catch (error) {
    console.error('Error creating deck:', error);
    return NextResponse.json(
      { error: 'Failed to create deck' },
      { status: 500 }
    );
  }
}