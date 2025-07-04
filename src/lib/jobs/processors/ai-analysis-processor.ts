import { Worker, Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { analyzeWithAI } from '@/lib/analysis/ai-deck-analyzer';
import type { DeckCard, Card } from '@prisma/client';
import {
  AIAnalysisJobData,
  AIAnalysisResult,
  JobQueue,
  JobPriority
} from '../types';

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

export class AIAnalysisProcessor {
  private worker: Worker | null = null;

  async initialize() {
    // Only initialize worker if Redis is available
    if (!process.env.REDIS_URL && !process.env.KV_URL) {
      console.log('Redis not configured - AI analysis processor will not be initialized');
      return;
    }

    const connection = this.getRedisConnection();

    this.worker = new Worker(
      JobQueue.AI_ANALYSIS,
      this.process.bind(this),
      {
        connection,
        concurrency: 2, // Process 2 AI analysis jobs concurrently
      }
    );

    this.setupEventHandlers();
  }

  private getRedisConnection() {
    const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || '';
    
    if (REDIS_URL) {
      try {
        const url = new URL(REDIS_URL);
        return {
          host: url.hostname,
          port: parseInt(url.port || '6379'),
          password: url.password || process.env.KV_REST_API_TOKEN,
          username: url.username || undefined,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 0,
        };
      } catch (error) {
        console.error('Failed to parse Redis URL:', error);
      }
    }
    
    // Fallback to localhost
    return {
      host: 'localhost',
      port: 6379,
      password: process.env.KV_REST_API_TOKEN,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    };
  }

  private async process(job: Job<AIAnalysisJobData>): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    const { analysisId, deckId, userId, model, focusAreas, userAge, options } = job.data;

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
        processingTimeMs,
        tokensUsed: undefined, // Could be extracted from OpenAI response
        cost: undefined // Could be calculated based on tokens
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
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

  private setupEventHandlers() {
    if (!this.worker) return;

    this.worker.on('completed', (job) => {
      console.log(`AI Analysis job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`AI Analysis job ${job?.id} failed:`, err);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`AI Analysis job ${jobId} stalled`);
    });
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

// Export singleton instance
export const aiAnalysisProcessor = new AIAnalysisProcessor();