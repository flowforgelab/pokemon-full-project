import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionBuilder } from '@/lib/recommendations/collection-builder';
import { z } from 'zod';

const collectionSchema = z.object({
  action: z.enum(['build', 'almost-complete', 'optimize', 'want-list']),
  targetDeckId: z.string().optional(),
  completionThreshold: z.number().min(50).max(100).default(80),
  goals: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const validatedData = collectionSchema.parse(body);

    const collectionBuilder = new CollectionBuilder();

    switch (validatedData.action) {
      case 'build': {
        // Build deck from collection
        const config = {
          userId: user.id,
          preferences: {
            favoriteArchetypes: [],
            avoidArchetypes: [],
            playstylePreference: 'balanced' as const,
            complexityPreference: 'moderate' as const,
            budgetFlexibility: 0.5,
          },
          constraints: {
            format: 'Standard' as any,
            onlyOwnedCards: true,
          },
          goals: {
            targetTier: 2,
            learningFocus: false,
            innovationDesired: false,
          },
        };

        const recommendation = await collectionBuilder.buildFromCollection(user.id, config);
        
        return NextResponse.json({
          recommendation: {
            id: recommendation.id,
            type: recommendation.type,
            deckList: recommendation.suggestedChanges.map(change => ({
              card: {
                id: change.card.id,
                name: change.card.name,
                imageUrl: change.card.imageUrlSmall,
                supertype: change.card.supertype,
              },
              quantity: change.quantity,
            })),
            completeness: recommendation.reasoning.find(r => r.includes('completion'))?.match(/\d+/)?.[0] || '0',
            reasoning: recommendation.reasoning,
            confidence: recommendation.confidence,
          },
        });
      }

      case 'almost-complete': {
        // Find almost complete decks
        const recommendations = await collectionBuilder.findAlmostCompleteDecks(
          user.id,
          validatedData.completionThreshold
        );

        return NextResponse.json({
          recommendations: recommendations.map(rec => ({
            id: rec.id,
            archetype: getArchetypeFromReasoning(rec.reasoning),
            completionRate: parseFloat(
              rec.reasoning.find(r => r.includes('% complete'))?.match(/\d+/)?.[0] || '0'
            ),
            missingCards: parseInt(
              rec.reasoning.find(r => r.includes('cards needed'))?.match(/\d+/)?.[0] || '0'
            ),
            completionCost: parseFloat(
              rec.reasoning.find(r => r.includes('cost to complete'))?.match(/\$(\d+)/)?.[1] || '0'
            ),
            confidence: rec.confidence,
          })),
        });
      }

      case 'optimize': {
        // Optimize collection for goals
        const result = await collectionBuilder.optimizeCollection(
          user.id,
          validatedData.goals || []
        );

        return NextResponse.json({
          recommendations: result.recommendations.map(rec => ({
            id: rec.id,
            type: rec.type,
            goal: validatedData.goals?.[0] || 'general',
            reasoning: rec.reasoning,
          })),
          tradeSuggestions: result.tradeSuggestions.map(trade => ({
            card: {
              id: trade.card.id,
              name: trade.card.name,
              imageUrl: trade.card.imageUrlSmall,
            },
            quantity: trade.quantity,
            estimatedValue: trade.estimatedValue,
            reasoning: trade.reasoning,
          })),
          acquisitionTargets: result.acquisitionTargets.map(target => ({
            card: {
              id: target.card.id,
              name: target.card.name,
              imageUrl: target.card.imageUrlSmall,
            },
            quantity: target.quantity,
            estimatedCost: target.estimatedCost,
            priority: target.priority,
            appearsInDecks: target.appearsInDecks,
          })),
        });
      }

      case 'want-list': {
        // Generate want list for target deck
        if (!validatedData.targetDeckId) {
          return NextResponse.json(
            { error: 'Target deck ID required for want list' },
            { status: 400 }
          );
        }

        const targetDeck = await prisma.deck.findFirst({
          where: {
            id: validatedData.targetDeckId,
            userId: user.id,
          },
          include: {
            cards: {
              include: { card: true },
            },
          },
        });

        if (!targetDeck) {
          return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        const wantList = await collectionBuilder.generateWantList(user.id, targetDeck);

        return NextResponse.json({
          wantList: wantList.map(item => ({
            card: {
              id: item.card.id,
              name: item.card.name,
              imageUrl: item.card.imageUrlSmall,
              rarity: item.card.rarity,
            },
            needed: item.quantityNeeded,
            owned: item.quantityOwned,
            estimatedCost: item.estimatedCost,
            priority: item.priority,
            alternatives: item.alternatives.map(alt => ({
              id: alt.id,
              name: alt.name,
              imageUrl: alt.imageUrlSmall,
            })),
          })),
          totalCost: wantList.reduce((sum, item) => sum + item.estimatedCost, 0),
          totalCards: wantList.reduce((sum, item) => sum + item.quantityNeeded, 0),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error with collection recommendations:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process collection request' },
      { status: 500 }
    );
  }
}

function getArchetypeFromReasoning(reasoning: string[]): string {
  const fullText = reasoning.join(' ').toLowerCase();
  
  if (fullText.includes('aggro')) return 'Aggro';
  if (fullText.includes('control')) return 'Control';
  if (fullText.includes('combo')) return 'Combo';
  if (fullText.includes('midrange')) return 'Midrange';
  if (fullText.includes('mill')) return 'Mill';
  if (fullText.includes('stall')) return 'Stall';
  if (fullText.includes('toolbox')) return 'Toolbox';
  if (fullText.includes('turbo')) return 'Turbo';
  if (fullText.includes('spread')) return 'Spread';
  
  return 'Unknown';
}