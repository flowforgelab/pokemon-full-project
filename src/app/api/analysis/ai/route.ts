/**
 * API Route for AI-powered deck analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import { getAiAnalysisQueue } from '@/lib/jobs/queue-runtime';
import { createDirectQueue } from '@/lib/jobs/direct-queue';
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
    
    // Check if we have Redis configured
    const hasRedis = process.env.REDIS_URL || process.env.KV_URL;
    console.log('Redis check:', {
      REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
      KV_URL: process.env.KV_URL ? 'Set' : 'Not set',
      hasRedis: !!hasRedis,
      NODE_ENV: process.env.NODE_ENV,
      BUILDING: process.env.BUILDING
    });
    
    // FORCE queue usage in production - remove the if check temporarily
    const forceQueue = process.env.NODE_ENV === 'production' || hasRedis;
    
    if (forceQueue) {
      try {
        // Add job to queue
        console.log('Using Redis queue for AI analysis (forced in production)');
        // Use direct queue creation to bypass any caching issues
        const queue = createDirectQueue('ai-analysis');
        console.log('Queue obtained:', queue.constructor.name);
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
        
        console.log('Job created successfully:', job.id);
      } catch (queueError) {
        console.error('Failed to use queue, falling back:', queueError);
        throw queueError; // Don't fall back, fail loudly
      }
    } else {
      // Fallback: Run analysis directly in development without Redis
      console.log('Redis not configured - running analysis directly');
      console.log('This should NOT happen in production!');
      
      // Import the analyzer function and system prompt
      const { analyzeWithAI } = await import('@/lib/analysis/ai-deck-analyzer');
      const fs = await import('fs');
      const path = await import('path');
      
      let systemPrompt = '';
      try {
        systemPrompt = fs.readFileSync(
          path.join(process.cwd(), 'AI_DECK_ANALYZER_PROMPT.md'),
          'utf-8'
        );
      } catch (error) {
        console.error('Failed to load AI analyzer prompt:', error);
        systemPrompt = `You are an expert Pokemon TCG analyst. Provide comprehensive deck analysis in JSON format.`;
      }
      
      // Update status to processing
      await prisma.analysis.update({
        where: { id: analysisRecord.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          jobId: 'mock-' + analysisRecord.id
        }
      });
      
      // Run analysis immediately (don't wait)
      setTimeout(async () => {
        try {
          console.log('Starting direct analysis for:', analysisRecord.id);
          
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
          
          console.log('Calling analyzeWithAI...');
          const analysis = await analyzeWithAI(
            deck.cards,
            deck.name,
            {
              apiKey: process.env.OPENAI_API_KEY!,
              model: validated.options?.model || 'gpt-3.5-turbo',
              temperature: validated.options?.temperature || 0.3,
              systemPrompt: customPrompt,
              userAge: validated.options?.userAge
            }
          );
          
          console.log('Analysis complete, updating database...');
          // Update with result
          await prisma.analysis.update({
            where: { id: analysisRecord.id },
            data: {
              status: 'COMPLETED',
              result: analysis as any,
              completedAt: new Date()
            }
          });
          console.log('Analysis saved successfully');
        } catch (error) {
          console.error('Analysis failed:', error);
          await prisma.analysis.update({
            where: { id: analysisRecord.id },
            data: {
              status: 'FAILED',
              error: error instanceof Error ? error.message : 'Unknown error',
              completedAt: new Date()
            }
          });
        }
      }, 100); // Small delay to ensure response is sent first
    }
    
    // Track usage for rate limiting (free users get 5 per day)
    const dailyLimit = !user ? 5 :
                      user.subscriptionTier === 'ULTIMATE' ? 50 :
                      user.subscriptionTier === 'PREMIUM' ? 20 :
                      user.subscriptionTier === 'BASIC' ? 10 : 5;
    
    // Simple in-memory rate limiting (should use Redis in production)
    // TODO: Implement proper rate limiting with Redis
    
    // Get the updated analysis record to get the jobId
    const updatedAnalysis = await prisma.analysis.findUnique({
      where: { id: analysisRecord.id },
      select: { jobId: true }
    });
    
    return NextResponse.json({
      success: true,
      analysisId: analysisRecord.id,
      jobId: updatedAnalysis?.jobId || 'mock-' + analysisRecord.id,
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