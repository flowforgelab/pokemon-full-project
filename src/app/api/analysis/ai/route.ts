/**
 * API Route for AI-powered deck analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import { aiAnalysisQueue } from '@/lib/jobs/queue';
import type { AIAnalysisJobData } from '@/lib/jobs/types';

// Configure route segment to allow longer timeout
export const maxDuration = 60; // 60 seconds timeout for Vercel

// Request validation schema
const aiAnalysisSchema = z.object({
  deckId: z.string().min(1, 'Deck ID is required'),
  options: z.object({
    model: z.enum(['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4o-mini']).optional(),
    temperature: z.number().min(0).max(1).optional(),
    focusAreas: z.array(z.enum([
      'competitive', 'budget', 'beginner', 'synergy', 'matchups'
    ])).optional(),
    userAge: z.number().min(5).max(99).optional()
  }).optional()
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Validate request
    const body = await req.json();
    console.log('AI Analysis Request:', { deckId: body.deckId, userId });
    const validated = aiAnalysisSchema.parse(body);
    
    // Get user first to get their database ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, subscriptionTier: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get deck with cards
    let deck;
    try {
      deck = await prisma.deck.findFirst({
        where: { 
          id: validated.deckId,
          userId: user.id // Use database user ID, not Clerk ID
        },
        include: {
          cards: {
            include: {
              card: true
            }
          }
        }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      console.log('Deck ID:', validated.deckId);
      console.log('User ID:', user.id);
      
      // Try to parse the error message for more details
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      
      return NextResponse.json(
        { 
          error: 'Failed to retrieve deck',
          details: errorMessage,
          deckId: validated.deckId
        },
        { status: 500 }
      );
    }
    
    if (!deck) {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }
    
    // AI analysis is now free for all users
    
    // Verify OpenAI API key is configured before queueing
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { error: 'AI analysis service not configured' },
        { status: 500 }
      );
    }
    
    // Create analysis record
    const analysisRecord = await prisma.analysis.create({
      data: {
        deckId: deck.id,
        userId: user.id,
        status: 'PENDING',
        model: validated.options?.model || 'gpt-3.5-turbo',
        focusAreas: validated.options?.focusAreas || [],
        userAge: validated.options?.userAge
      }
    });
    
    // Create job data
    const jobData: AIAnalysisJobData = {
      analysisId: analysisRecord.id,
      deckId: deck.id,
      userId: user.id,
      model: validated.options?.model || 'gpt-3.5-turbo',
      focusAreas: validated.options?.focusAreas,
      userAge: validated.options?.userAge,
      options: {
        temperature: validated.options?.temperature || 0.3
      }
    };
    
    // Add job to queue
    const queue = await aiAnalysisQueue;
    const job = await queue.add('analyze-deck', jobData, {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 30000
      }
    });
    
    // Update analysis record with jobId
    await prisma.analysis.update({
      where: { id: analysisRecord.id },
      data: { jobId: job.id }
    });
    
    // Track usage for rate limiting (free users get 5 per day)
    const dailyLimit = !user ? 5 :
                      user.subscriptionTier === 'ULTIMATE' ? 50 :
                      user.subscriptionTier === 'PREMIUM' ? 20 :
                      user.subscriptionTier === 'BASIC' ? 10 : 5;
    
    // Simple in-memory rate limiting (should use Redis in production)
    // TODO: Implement proper rate limiting with Redis
    
    return NextResponse.json({
      success: true,
      analysisId: analysisRecord.id,
      jobId: job.id,
      status: 'PENDING',
      message: 'Analysis has been queued and will be processed shortly',
      deck: {
        id: deck.id,
        name: deck.name,
        format: deck.formatId || 'STANDARD'
      },
      usage: {
        remaining: dailyLimit - 1, // Simplified
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    
  } catch (error) {
    console.error('AI analysis error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check rate limits
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { subscriptionTier: true }
    });
    
    // Free tier now has access to AI analysis with daily limit
    const dailyLimit = !user ? 5 :
                      user.subscriptionTier === 'ULTIMATE' ? 50 :
                      user.subscriptionTier === 'PREMIUM' ? 20 :
                      user.subscriptionTier === 'BASIC' ? 10 : 5;
    
    return NextResponse.json({
      tier: user?.subscriptionTier || 'FREE',
      dailyLimit,
      used: 0, // TODO: Track actual usage
      remaining: dailyLimit,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      features: {
        aiAnalysis: true, // Now available to all users
        models: user?.subscriptionTier === 'ULTIMATE' ? 
          ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'] :
          ['gpt-3.5-turbo'],
        temperature: user?.subscriptionTier === 'ULTIMATE'
      }
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get usage info' },
      { status: 500 }
    );
  }
}