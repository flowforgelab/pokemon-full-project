import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/lib/db';

// GET - Load deck
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

    // Get deck details
    const deck = await prisma.deck.findUnique({
      where: { id: params.deckId },
      include: {
        format: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({
      deck,
      composition,
    });
  } catch (error: any) {
    console.error('Error loading deck:', error);
    
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
      { error: 'Failed to load deck' },
      { status: 500 }
    );
  }
}

// PUT - Save deck
const saveDeckSchema = z.object({
  composition: z.object({
    mainDeck: z.object({
      pokemon: z.array(z.any()),
      trainers: z.array(z.any()),
      energy: z.array(z.any()),
      totalCards: z.number(),
    }),
    sideboard: z.object({
      pokemon: z.array(z.any()),
      trainers: z.array(z.any()),
      energy: z.array(z.any()),
      totalCards: z.number(),
    }),
    totalCards: z.number(),
    energyCount: z.number(),
    trainerCount: z.number(),
    pokemonCount: z.number(),
    deckValidation: z.array(z.any()),
    lastModified: z.string().transform(str => new Date(str)),
  }),
});

export async function PUT(
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
    const validation = saveDeckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { composition } = validation.data;

    // Save deck
    await deckBuilderManager.saveDeck(
      params.deckId,
      composition,
      user.id
    );

    return NextResponse.json({
      success: true,
      message: 'Deck saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving deck:', error);
    
    if (error.message === 'Unauthorized to save deck') {
      return NextResponse.json(
        { error: 'Unauthorized to save deck' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save deck' },
      { status: 500 }
    );
  }
}

// DELETE - Delete deck
export async function DELETE(
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

    // Check ownership
    const deck = await prisma.deck.findUnique({
      where: { id: params.deckId },
      select: { userId: true },
    });

    if (!deck) {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }

    if (deck.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete deck' },
        { status: 403 }
      );
    }

    // Delete deck
    await prisma.deck.delete({
      where: { id: params.deckId },
    });

    return NextResponse.json({
      success: true,
      message: 'Deck deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting deck:', error);
    return NextResponse.json(
      { error: 'Failed to delete deck' },
      { status: 500 }
    );
  }
}