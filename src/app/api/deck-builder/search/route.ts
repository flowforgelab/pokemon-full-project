import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/lib/db';
import { Supertype, Rarity } from '@prisma/client';

const searchSchema = z.object({
  text: z.string().optional(),
  types: z.array(z.nativeEnum(Supertype)).optional(),
  sets: z.array(z.string()).optional(),
  rarities: z.array(z.nativeEnum(Rarity)).optional(),
  energyCost: z.array(z.number()).optional(),
  hp: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  formatLegality: z.string().optional(),
  owned: z.boolean().optional(),
  inCurrentDeck: z.boolean().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  deckId: z.string().optional(),
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
    const validation = searchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { page, pageSize, deckId, ...filters } = validation.data;

    // Get current deck card IDs if filtering
    let deckCardIds: string[] | undefined;
    if (deckId && filters.inCurrentDeck !== undefined) {
      const deckCards = await prisma.deckCard.findMany({
        where: { deckId },
        select: { cardId: true },
      });
      deckCardIds = deckCards.map(dc => dc.cardId);
    }

    // Search cards
    const searchResults = await deckBuilderManager.searchCards(
      filters,
      page,
      pageSize,
      deckCardIds
    );

    // If searching for owned cards, get ownership data
    if (filters.owned) {
      const cardIds = searchResults.cards.map(c => c.id);
      const ownedQuantities = await prisma.userCollection.findMany({
        where: {
          userId: user.id,
          cardId: { in: cardIds },
        },
        select: {
          cardId: true,
          quantity: true,
        },
      });

      const ownedMap = new Map(ownedQuantities.map(oq => [oq.cardId, oq.quantity]));
      
      // Add ownership data to cards
      searchResults.cards = searchResults.cards.map(card => ({
        ...card,
        ownedQuantity: ownedMap.get(card.id) || 0,
      }));
    }

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Error searching cards:', error);
    return NextResponse.json(
      { error: 'Failed to search cards' },
      { status: 500 }
    );
  }
}