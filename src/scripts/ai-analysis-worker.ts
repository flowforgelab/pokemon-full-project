/**
 * Dedicated AI Analysis Worker
 * This script runs the AI analysis job processor
 */

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
import { Worker, Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { analyzeWithAI } from '@/lib/analysis/ai-deck-analyzer';
import type { AIAnalysisJobData } from '@/lib/jobs/types';
import type { DeckCard, Card } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load system prompt
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

async function processAIAnalysis(job: Job<AIAnalysisJobData>) {
  const startTime = Date.now();
  const { analysisId, deckId, userId, model, focusAreas, userAge, options } = job.data;
  
  console.log(`[Job ${job.id}] Starting AI analysis for deck ${deckId}`);

  try {
    // Update analysis status to processing
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date()
      }
    });

    await job.log(`Starting AI analysis for deck ${deckId}`);

    // Get deck with cards
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    });

    if (!deck) {
      throw new Error('Deck not found');
    }

    // Verify deck belongs to user
    if (deck.userId !== userId) {
      throw new Error('Unauthorized: Deck does not belong to user');
    }

    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Customize prompt based on focus areas
    let customPrompt = systemPrompt;
    
    if (focusAreas && focusAreas.length > 0) {
      customPrompt += '\n\nFOCUS AREAS: Please pay special attention to:\n';
      focusAreas.forEach(area => {
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

    // Type the deck cards properly for the analyzer
    const typedDeckCards = deck.cards as Array<DeckCard & { card: Card }>;

    // Perform AI analysis
    await job.log('Calling OpenAI Assistant API...');
    console.log(`[Job ${job.id}] Calling OpenAI with model ${model}`);
    
    const analysis = await analyzeWithAI(
      typedDeckCards,
      deck.name,
      {
        apiKey,
        model: model || 'gpt-3.5-turbo',
        temperature: options?.temperature || 0.3,
        systemPrompt: customPrompt,
        userAge
      }
    );

    const processingTimeMs = Date.now() - startTime;
    await job.log(`Analysis completed in ${processingTimeMs}ms`);
    console.log(`[Job ${job.id}] Analysis completed in ${processingTimeMs}ms`);

    // Update analysis record with result
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        result: analysis as any,
        completedAt: new Date()
      }
    });

    return {
      analysisId,
      analysis,
      processingTimeMs
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Job ${job.id}] Failed:`, error);
    
    // Update analysis record with error
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'FAILED',
        error: errorMessage,
        completedAt: new Date()
      }
    });

    throw error;
  }
}

async function startWorker() {
  console.log('Environment check:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');
  console.log('REDIS_URL:', process.env.REDIS_URL ? '✓ Set' : '✗ Not set');
  console.log('KV_URL:', process.env.KV_URL ? '✓ Set' : '✗ Not set');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set');
  
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  
  if (!redisUrl) {
    console.error('❌ No Redis URL found in environment variables');
    console.error('Please set REDIS_URL or KV_URL in Railway environment variables');
    process.exit(1);
  }

  console.log('Starting AI Analysis Worker...');
  console.log(`Redis URL: ${redisUrl.substring(0, 30)}...`);

  try {
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || process.env.KV_REST_API_TOKEN,
      username: url.username || undefined,
      // Add TLS support for rediss:// URLs
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    };

    const worker = new Worker(
      'ai-analysis',
      processAIAnalysis,
      {
        connection,
        concurrency: 2,
      }
    );

    worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    console.log('✅ AI Analysis Worker started successfully');
    console.log('Waiting for jobs...\n');

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down worker...');
      await worker.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Start the worker
startWorker().catch(console.error);