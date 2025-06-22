import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/db';
import { RecommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { z } from 'zod';
import { DeckArchetype } from '@/lib/analysis/types';

const buildSchema = z.object({
  preferences: z.object({
    favoriteArchetypes: z.array(z.nativeEnum(DeckArchetype)).optional(),
    avoidArchetypes: z.array(z.nativeEnum(DeckArchetype)).optional(),
    playstyle: z.enum(['aggressive', 'defensive', 'balanced', 'combo']).optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
  }).optional(),
  constraints: z.object({
    maxBudget: z.number().min(0).optional(),
    format: z.enum(['Standard', 'Expanded', 'Unlimited']).default('Standard'),
    onlyOwnedCards: z.boolean().optional(),
    mustIncludeCards: z.array(z.string()).optional(),
    mustExcludeCards: z.array(z.string()).optional(),
  }),
  goals: z.object({
    targetTier: z.number().min(1).max(4).optional(),
    tournamentPrep: z.boolean().optional(),
    learningFocus: z.boolean().optional(),
    innovationDesired: z.boolean().optional(),
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
    const validatedData = buildSchema.parse(body);

    // Create builder config
    const builderConfig = {
      userId: user.id,
      preferences: {
        favoriteArchetypes: validatedData.preferences?.favoriteArchetypes || [],
        avoidArchetypes: validatedData.preferences?.avoidArchetypes || [],
        playstylePreference: validatedData.preferences?.playstyle || 'balanced' as const,
        complexityPreference: validatedData.preferences?.complexity || 'moderate' as const,
        budgetFlexibility: 0.5,
      },
      constraints: {
        maxBudget: validatedData.constraints.maxBudget,
        format: validatedData.constraints.format as any,
        onlyOwnedCards: validatedData.constraints.onlyOwnedCards,
        mustIncludeCards: validatedData.constraints.mustIncludeCards,
        mustExcludeCards: validatedData.constraints.mustExcludeCards,
      },
      goals: {
        targetTier: validatedData.goals?.targetTier || 2,
        tournamentPrep: validatedData.goals?.tournamentPrep || false,
        learningFocus: validatedData.goals?.learningFocus || false,
        innovationDesired: validatedData.goals?.innovationDesired || false,
      },
    };

    // Build decks from scratch
    const engine = new RecommendationEngine();
    const recommendations = await engine.buildDeckFromScratch(builderConfig);

    // Transform recommendations for API response
    const response = recommendations.map(rec => ({
      id: rec.id,
      type: rec.type,
      archetype: getArchetypeFromRecommendation(rec),
      deckList: rec.suggestedChanges.map(change => ({
        card: {
          id: change.card.id,
          name: change.card.name,
          imageUrl: change.card.imageUrl,
          supertype: change.card.supertype,
          types: change.card.types,
          hp: change.card.hp,
          rarity: change.card.rarity,
        },
        quantity: change.quantity,
        role: change.reasoning,
      })),
      strategy: rec.reasoning[0] || 'Optimized deck build',
      strengths: rec.reasoning.slice(1, 4),
      estimatedCost: rec.costAnalysis.totalCost,
      difficulty: rec.difficultyRating,
      metaRelevance: rec.metaRelevance,
      confidence: rec.confidence,
      upgradePath: rec.alternativeOptions.map(alt => ({
        cost: alt.totalCost,
        impact: alt.totalImpact,
        description: alt.reasoning,
      })),
    }));

    return NextResponse.json({
      recommendations: response,
      config: {
        budget: validatedData.constraints.maxBudget,
        format: validatedData.constraints.format,
        preferences: validatedData.preferences,
      },
    });
  } catch (error) {
    console.error('Error building deck:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to build deck' },
      { status: 500 }
    );
  }
}

function getArchetypeFromRecommendation(rec: any): string {
  // Extract archetype from reasoning or changes
  const archetypeKeywords = {
    [DeckArchetype.AGGRO]: ['aggro', 'fast', 'rush'],
    [DeckArchetype.CONTROL]: ['control', 'defensive', 'disrupt'],
    [DeckArchetype.COMBO]: ['combo', 'synergy', 'engine'],
    [DeckArchetype.MIDRANGE]: ['midrange', 'balanced', 'versatile'],
    [DeckArchetype.MILL]: ['mill', 'deck out', 'discard'],
    [DeckArchetype.STALL]: ['stall', 'wall', 'tank'],
    [DeckArchetype.TOOLBOX]: ['toolbox', 'tech', 'flexible'],
    [DeckArchetype.TURBO]: ['turbo', 'speed', 'accelerate'],
    [DeckArchetype.SPREAD]: ['spread', 'bench', 'damage all'],
  };

  const reasoning = rec.reasoning.join(' ').toLowerCase();
  
  for (const [archetype, keywords] of Object.entries(archetypeKeywords)) {
    if (keywords.some(keyword => reasoning.includes(keyword))) {
      return archetype;
    }
  }

  return DeckArchetype.MIDRANGE; // Default
}