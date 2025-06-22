import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/db';
import { RecommendationEngine } from '@/lib/recommendations/recommendation-engine';
import { z } from 'zod';

const feedbackSchema = z.object({
  recommendationId: z.string(),
  accepted: z.boolean(),
  implementedChanges: z.array(z.object({
    cardId: z.string(),
    quantity: z.number(),
    action: z.enum(['add', 'remove', 'replace']),
  })).optional(),
  performanceMetrics: z.object({
    winRate: z.number().min(0).max(1),
    consistency: z.number().min(0).max(1),
    enjoyment: z.number().min(1).max(10),
    easeOfPlay: z.number().min(1).max(10),
    matchupsPlayed: z.array(z.object({
      opponent: z.string(),
      wins: z.number(),
      losses: z.number(),
      notes: z.string().optional(),
    })).optional(),
  }).optional(),
  userRating: z.number().min(1).max(5).optional(),
  comments: z.string().optional(),
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
    const validatedData = feedbackSchema.parse(body);

    // Transform implemented changes to include card data
    const implementedChanges = [];
    if (validatedData.implementedChanges) {
      for (const change of validatedData.implementedChanges) {
        const card = await prisma.card.findUnique({
          where: { id: change.cardId },
        });
        
        if (card) {
          implementedChanges.push({
            action: change.action,
            card,
            quantity: change.quantity,
            reasoning: '',
            impact: 0,
            synergyChanges: [],
          });
        }
      }
    }

    // Create feedback object
    const feedback = {
      recommendationId: validatedData.recommendationId,
      userId: user.id,
      accepted: validatedData.accepted,
      implemented: implementedChanges,
      performanceAfter: validatedData.performanceMetrics ? {
        winRate: validatedData.performanceMetrics.winRate,
        consistency: validatedData.performanceMetrics.consistency,
        enjoyment: validatedData.performanceMetrics.enjoyment,
        easeOfPlay: validatedData.performanceMetrics.easeOfPlay,
        matchupsPlayed: validatedData.performanceMetrics.matchupsPlayed?.map(m => ({
          opponent: m.opponent as any,
          wins: m.wins,
          losses: m.losses,
          notes: m.notes,
        })) || [],
      } : undefined,
      userRating: validatedData.userRating,
      comments: validatedData.comments,
    };

    // Record feedback in recommendation engine
    const engine = new RecommendationEngine();
    await engine.recordFeedback(feedback);

    // Store feedback in database (optional - for analytics)
    // await prisma.recommendationFeedback.create({ ... });

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded successfully',
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
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

    // Get feedback history summary (would come from database in production)
    const summary = {
      totalFeedback: 0,
      acceptanceRate: 0,
      averageRating: 0,
      preferredArchetypes: [],
      avoidedCards: [],
    };

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error getting feedback summary:', error);
    return NextResponse.json(
      { error: 'Failed to get feedback summary' },
      { status: 500 }
    );
  }
}