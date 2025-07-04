#!/usr/bin/env tsx
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@/server/db/prisma';
import { aiAnalysisQueue } from '@/lib/jobs/queue';
import { aiAnalysisProcessor } from '@/lib/jobs/processors/ai-analysis-processor';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testAIAnalysisJob() {
  console.log('🧪 Testing AI Analysis Job Processing\n');

  // Check prerequisites
  const checks = {
    redis: !!process.env.REDIS_URL || !!process.env.KV_URL,
    openai: !!process.env.OPENAI_API_KEY,
    database: false,
    user: false,
    deck: false,
  };

  console.log('Prerequisites Check:');
  console.log('- Redis configured:', checks.redis ? '✅' : '❌');
  console.log('- OpenAI API key:', checks.openai ? '✅' : '❌');

  if (!checks.redis) {
    console.error('\n❌ Redis is not configured. Please set REDIS_URL in your .env.local file');
    console.log('\nTo fix this:');
    console.log('1. Start Redis locally: docker-compose up -d');
    console.log('2. Add to .env.local: REDIS_URL=redis://localhost:6379');
    process.exit(1);
  }

  if (!checks.openai) {
    console.error('\n❌ OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env.local file');
    console.log('\nTo fix this:');
    console.log('1. Get your API key from: https://platform.openai.com');
    console.log('2. Add to .env.local: OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  try {
    // Test database connection
    await prisma.$connect();
    checks.database = true;
    console.log('- Database connection:', '✅');

    // Find or create test user
    const testEmail = 'test@pokemon-tcg.com';
    let user = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (!user) {
      console.log('\nCreating test user...');
      user = await prisma.user.create({
        data: {
          id: 'test-user-' + Date.now(),
          email: testEmail,
          username: 'test-user',
          displayName: 'Test User',
        }
      });
    }
    checks.user = true;
    console.log('- Test user:', '✅');

    // Find or create test deck
    let deck = await prisma.deck.findFirst({
      where: { userId: user.id },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    });

    if (!deck || deck.cards.length === 0) {
      console.log('\nCreating test deck...');
      
      // Find some Pokemon cards for the test deck
      const cards = await prisma.card.findMany({
        where: {
          supertype: 'Pokémon',
        },
        take: 10,
      });

      if (cards.length === 0) {
        console.error('❌ No Pokemon cards found in database. Please import card data first.');
        process.exit(1);
      }

      // Create deck with cards
      deck = await prisma.deck.create({
        data: {
          name: 'Test Deck for AI Analysis',
          userId: user.id,
          format: 'standard',
          cards: {
            create: cards.map((card, index) => ({
              cardId: card.id,
              count: index < 4 ? 2 : 1, // Add 2 copies of first 4 cards, 1 of others
            }))
          }
        },
        include: {
          cards: {
            include: {
              card: true
            }
          }
        }
      });
    }
    checks.deck = true;
    console.log('- Test deck:', '✅');
    console.log(`  Deck: ${deck.name} (${deck.cards.length} unique cards)`);

    // Initialize AI analysis processor
    console.log('\n🚀 Initializing AI Analysis Processor...');
    await aiAnalysisProcessor.initialize();

    // Create analysis record
    console.log('\n📝 Creating analysis record...');
    const analysis = await prisma.analysis.create({
      data: {
        deckId: deck.id,
        userId: user.id,
        status: 'PENDING',
        model: 'gpt-3.5-turbo',
        focusAreas: ['competitive', 'synergy'],
      }
    });

    // Add job to queue
    console.log('\n📬 Adding job to queue...');
    const queue = await aiAnalysisQueue;
    const job = await queue.add('analyze-deck', {
      analysisId: analysis.id,
      deckId: deck.id,
      userId: user.id,
      model: 'gpt-3.5-turbo',
      focusAreas: ['competitive', 'synergy'],
      userAge: 25,
      options: {
        temperature: 0.3,
      }
    });

    console.log(`✅ Job added to queue with ID: ${job.id}`);

    // Wait for job completion
    console.log('\n⏳ Waiting for job to complete...');
    const startTime = Date.now();
    
    // Poll for completion
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const jobStatus = await job.getState();
      const updatedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysis.id }
      });

      console.log(`   Status: ${jobStatus} | Analysis: ${updatedAnalysis?.status}`);

      if (jobStatus === 'completed' || updatedAnalysis?.status === 'COMPLETED') {
        completed = true;
        const duration = (Date.now() - startTime) / 1000;
        console.log(`\n✅ Job completed in ${duration.toFixed(1)} seconds!`);

        if (updatedAnalysis?.result) {
          console.log('\n📊 Analysis Result:');
          console.log(JSON.stringify(updatedAnalysis.result, null, 2));
        }
      } else if (jobStatus === 'failed' || updatedAnalysis?.status === 'FAILED') {
        const failedJob = await job.getState();
        console.error(`\n❌ Job failed: ${updatedAnalysis?.error || 'Unknown error'}`);
        
        // Get job logs
        const logs = await queue.getJobLogs(job.id);
        if (logs.logs.length > 0) {
          console.log('\nJob logs:');
          logs.logs.forEach(log => console.log(`  ${log}`));
        }
        
        break;
      }

      attempts++;
    }

    if (!completed && attempts >= maxAttempts) {
      console.error('\n❌ Job timed out after 60 seconds');
    }

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await aiAnalysisProcessor.close();

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n✨ Test complete!');
  process.exit(0);
}

// Run the test
testAIAnalysisJob().catch(console.error);