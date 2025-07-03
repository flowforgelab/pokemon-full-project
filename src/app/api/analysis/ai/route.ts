/**
 * API Route for AI-powered deck analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeWithAI } from '@/lib/analysis/ai-deck-analyzer';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';

// Configure route segment to allow longer timeout
export const maxDuration = 60; // 60 seconds timeout for Vercel

// Request validation schema
const aiAnalysisSchema = z.object({
  deckId: z.string().min(1, 'Deck ID is required'),
  options: z.object({
    model: z.enum(['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo']).optional(),
    temperature: z.number().min(0).max(1).optional(),
    focusAreas: z.array(z.enum([
      'competitive', 'budget', 'beginner', 'synergy', 'matchups'
    ])).optional()
  }).optional()
});

// Load system prompt
import { readFileSync } from 'fs';
import { join } from 'path';

let systemPrompt: string;
try {
  systemPrompt = readFileSync(
    join(process.cwd(), 'AI_DECK_ANALYZER_PROMPT.md'),
    'utf-8'
  );
} catch (error) {
  console.error('Failed to load AI analyzer prompt:', error);
  systemPrompt = `You are an expert Pokemon TCG analyst. Provide comprehensive deck analysis in JSON format.`;
}

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
    
    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { error: 'AI analysis service not configured' },
        { status: 500 }
      );
    }
    
    // Customize prompt based on focus areas
    let customPrompt = systemPrompt;
    if (validated.options?.focusAreas && validated.options.focusAreas.length > 0) {
      customPrompt += '\n\nFOCUS AREAS: Please pay special attention to:\n';
      validated.options.focusAreas.forEach(area => {
        switch (area) {
          case 'competitive':
            customPrompt += '- Competitive viability and tournament performance\n';
            break;
          case 'budget':
            customPrompt += '- Budget considerations and cost-effective alternatives\n';
            break;
          case 'beginner':
            customPrompt += '- Beginner-friendly explanations and simple improvements\n';
            break;
          case 'synergy':
            customPrompt += '- Card synergies, combos, and anti-synergies\n';
            break;
          case 'matchups':
            customPrompt += '- Detailed matchup analysis against meta decks\n';
            break;
        }
      });
    }
    
    // Perform AI analysis
    const analysis = await analyzeWithAI(
      deck.cards,
      deck.name,
      {
        apiKey,
        model: validated.options?.model || 'gpt-4-turbo-preview',
        temperature: validated.options?.temperature || 0.7,
        systemPrompt: customPrompt
      }
    );
    
    // TODO: Store analysis result for history/caching when DeckAnalysis table is created
    // Currently skipping storage as the table doesn't exist
    
    // Track usage for rate limiting (free users get 5 per day)
    const dailyLimit = !user ? 5 :
                      user.subscriptionTier === 'ULTIMATE' ? 50 :
                      user.subscriptionTier === 'PREMIUM' ? 20 :
                      user.subscriptionTier === 'BASIC' ? 10 : 5;
    
    // Simple in-memory rate limiting (should use Redis in production)
    // TODO: Implement proper rate limiting with Redis
    
    return NextResponse.json({
      success: true,
      analysis,
      deck: {
        id: deck.id,
        name: deck.name,
        format: deck.format
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