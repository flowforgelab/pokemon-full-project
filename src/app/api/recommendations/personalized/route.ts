import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { RecommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { z } from 'zod';
import { recommendationCache } from '@/lib/api/cache';
import type { RecommendationFilter } from '@/lib/recommendations/types';

// Unused filterSchema - commented out as it's not being used
// const filterSchema = z.object({
//   priceRange: z.object({
//     min: z.number().min(0),
//     max: z.number().min(0),
//   }).optional(),
//   ownedCardRequirement: z.number().min(0).max(100).optional(),
//   formatRestriction: z.enum(['Standard', 'Expanded', 'Unlimited']).optional(),
//   strategyPreferences: z.array(z.string()).optional(),
//   complexityLimit: z.number().min(1).max(10).optional(),
//   metaTierRequirement: z.number().min(1).max(4).optional(),
//   excludeCards: z.array(z.string()).optional(),
//   includeCards: z.array(z.string()).optional(),
// });

export async function GET(req: NextRequest) {
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

    // Parse query parameters for filters
    const searchParams = req.nextUrl.searchParams;
    const filter: RecommendationFilter = {};

    // Price range
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    if (minPrice || maxPrice) {
      filter.priceRange = {
        min: minPrice ? parseFloat(minPrice) : 0,
        max: maxPrice ? parseFloat(maxPrice) : 99999,
      };
    }

    // Other filters
    if (searchParams.get('ownedCardRequirement')) {
      filter.ownedCardRequirement = parseFloat(searchParams.get('ownedCardRequirement')!);
    }
    if (searchParams.get('format')) {
      filter.formatRestriction = searchParams.get('format') as any;
    }
    if (searchParams.get('complexity')) {
      filter.complexityLimit = parseInt(searchParams.get('complexity')!);
    }
    if (searchParams.get('metaTier')) {
      filter.metaTierRequirement = parseInt(searchParams.get('metaTier')!);
    }

    // Check cache
    const cacheKey = `recommendations:${user.id}:${JSON.stringify(filter)}`;
    const cached = await recommendationCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ recommendations: cached });
    }

    // Get personalized recommendations
    const engine = new RecommendationEngine();
    const recommendations = await engine.getPersonalizedRecommendations(
      user.id,
      filter
    );

    // Transform recommendations for API response
    const transformedRecommendations = recommendations.map(rec => ({
      id: rec.id,
      type: rec.type,
      timestamp: rec.timestamp,
      title: getRecommendationTitle(rec),
      description: rec.reasoning.join(' '),
      suggestedChanges: rec.suggestedChanges.map(change => ({
        action: change.action,
        card: {
          id: change.card.id,
          name: change.card.name,
          imageUrl: change.card.imageUrlSmallSmall,
          types: change.card.types,
          supertype: change.card.supertype,
        },
        quantity: change.quantity,
        reasoning: change.reasoning,
      })),
      impact: {
        overall: rec.expectedImpact.overallImprovement,
        consistency: rec.expectedImpact.consistencyChange,
        power: rec.expectedImpact.powerChange,
        speed: rec.expectedImpact.speedChange,
        versatility: rec.expectedImpact.versatilityChange,
        metaRelevance: rec.expectedImpact.metaRelevanceChange,
      },
      cost: {
        total: rec.costAnalysis.totalCost,
        net: rec.costAnalysis.netCost,
        hasBudgetAlternatives: rec.costAnalysis.budgetFriendlyAlternatives,
      },
      difficulty: rec.difficultyRating,
      confidence: rec.confidence,
      alternativeCount: rec.alternativeOptions.length,
    }));

    // Cache for 1 hour
    await recommendationCache.set(cacheKey, transformedRecommendations, 3600);

    return NextResponse.json({ 
      recommendations: transformedRecommendations,
      filter: filter,
    });
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

function getRecommendationTitle(rec: any): string {
  const titles: Record<string, string> = {
    build_from_scratch: 'New Deck Build',
    optimize_existing: 'Deck Optimization',
    budget_build: 'Budget-Friendly Build',
    collection_build: 'Build from Collection',
    meta_adaptation: 'Meta-Counter Strategy',
    upgrade_path: 'Upgrade Path',
  };
  
  return titles[rec.type] || 'Deck Recommendation';
}