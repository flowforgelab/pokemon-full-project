import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { RecommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { z } from 'zod';
import { OptimizationGoal } from '@/lib/recommendations/types';

const optimizeSchema = z.object({
  deckId: z.string().optional(),
  optimizationGoal: z.nativeEnum(OptimizationGoal),
  acceptableChanges: z.number().min(1).max(30).default(10),
  constraints: z.object({
    maxBudget: z.number().optional(),
    format: z.enum(['Standard', 'Expanded', 'Unlimited']).default('Standard'),
    onlyOwnedCards: z.boolean().optional(),
    mustIncludeCards: z.array(z.string()).optional(),
    mustExcludeCards: z.array(z.string()).optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
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
    const validatedData = optimizeSchema.parse(body);

    // Load deck if provided
    let deck = null;
    if (validatedData.deckId) {
      deck = await prisma.deck.findFirst({
        where: {
          id: validatedData.deckId,
          userId: user.id,
        },
        include: {
          cards: {
            include: { card: true },
          },
        },
      });

      if (!deck) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      }
    }

    // Create builder config
    const builderConfig = {
      userId: user.id,
      preferences: {
        favoriteArchetypes: [],
        avoidArchetypes: [],
        playstylePreference: 'balanced' as const,
        complexityPreference: 'moderate' as const,
        budgetFlexibility: 0.5,
      },
      constraints: {
        maxBudget: validatedData.constraints?.maxBudget,
        format: validatedData.constraints?.format as any,
        onlyOwnedCards: validatedData.constraints?.onlyOwnedCards,
        mustIncludeCards: validatedData.constraints?.mustIncludeCards,
        mustExcludeCards: validatedData.constraints?.mustExcludeCards,
      },
      goals: {
        targetTier: 2,
        learningFocus: false,
        innovationDesired: false,
      },
    };

    // Create optimization request
    const optimizationRequest = {
      deck,
      config: builderConfig,
      optimizationGoal: validatedData.optimizationGoal,
      acceptableChanges: validatedData.acceptableChanges,
    };

    // Perform optimization
    const engine = new RecommendationEngine();
    const result = await engine.optimizeDeck(optimizationRequest);

    // Transform result for API response
    const response = {
      originalDeck: deck ? {
        id: deck.id,
        name: deck.name,
        cardCount: deck.cards.reduce((sum, c) => sum + c.quantity, 0),
      } : null,
      optimizedDeck: result.optimizedDeck.map(card => ({
        id: card.id,
        name: card.name,
        imageUrl: card.imageUrl,
        supertype: card.supertype,
        types: card.types,
      })),
      changes: result.changes.map(change => ({
        action: change.action,
        card: {
          id: change.card.id,
          name: change.card.name,
          imageUrl: change.card.imageUrl,
        },
        currentCard: change.currentCard ? {
          id: change.currentCard.id,
          name: change.currentCard.name,
          imageUrl: change.currentCard.imageUrl,
        } : null,
        quantity: change.quantity,
        reasoning: change.reasoning,
        impact: change.impact,
      })),
      improvements: {
        overall: result.improvements.overallImprovement,
        consistency: result.improvements.consistencyChange,
        power: result.improvements.powerChange,
        speed: result.improvements.speedChange,
        versatility: result.improvements.versatilityChange,
        metaRelevance: result.improvements.metaRelevanceChange,
      },
      cost: {
        total: result.cost.totalCost,
        added: result.cost.addedCost,
        removed: result.cost.removedValue,
        net: result.cost.netCost,
      },
      variants: result.alternatives.map(alt => ({
        name: alt.name,
        type: alt.type,
        description: alt.description,
        pros: alt.pros,
        cons: alt.cons,
        estimatedCost: alt.estimatedCost,
        difficulty: alt.difficultyRating,
      })),
      explanation: result.explanation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error optimizing deck:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to optimize deck' },
      { status: 500 }
    );
  }
}