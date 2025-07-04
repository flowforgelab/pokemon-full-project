#!/usr/bin/env node
/**
 * Test the real analysis flow by creating an analysis through the API
 */

import 'dotenv/config';
import { Queue } from 'bullmq';
import { prisma } from '@/server/db/prisma';

async function testRealFlow() {
  console.log('=== TESTING REAL ANALYSIS FLOW ===\n');

  // 1. Find a test deck
  console.log('1. Finding a test deck...');
  const deck = await prisma.deck.findFirst({
    where: { cards: { some: {} } },
    include: { cards: { take: 3 } }
  });
  
  if (!deck) {
    console.log('   ❌ No deck found with cards');
    return;
  }
  
  console.log('   ✅ Found deck:', deck.name, `(${deck.cards.length} cards shown)`);

  // 2. Check recent analyses for this deck
  console.log('\n2. Checking recent analyses...');
  const recentAnalysis = await prisma.analysis.findFirst({
    where: { deckId: deck.id },
    orderBy: { createdAt: 'desc' }
  });
  
  if (recentAnalysis) {
    console.log('   Last analysis:', {
      id: recentAnalysis.id.substring(0, 8),
      status: recentAnalysis.status,
      jobId: recentAnalysis.jobId,
      createdAt: recentAnalysis.createdAt
    });
  }

  // 3. Check what's in the queue
  console.log('\n3. Checking queue status...');
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || '';
  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || process.env.KV_REST_API_TOKEN,
    username: url.username || undefined,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  };

  const queue = new Queue('ai-analysis', { connection });
  const counts = await queue.getJobCounts();
  console.log('   Queue counts:', counts);

  // 4. Get all jobs in the queue
  console.log('\n4. Inspecting queue jobs...');
  const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10);
  console.log('   Total jobs found:', jobs.length);
  
  jobs.forEach(job => {
    console.log(`   - Job ${job.id}:`, {
      name: job.name,
      status: job.progress,
      analysisId: job.data.analysisId?.substring(0, 8),
      created: new Date(job.timestamp).toISOString()
    });
  });

  // 5. Check for orphaned analyses (PENDING but no job)
  console.log('\n5. Checking for orphaned analyses...');
  const orphanedAnalyses = await prisma.analysis.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 minutes
    },
    take: 5
  });
  
  console.log('   Found', orphanedAnalyses.length, 'orphaned analyses');
  orphanedAnalyses.forEach(analysis => {
    console.log('   -', analysis.id.substring(0, 8), 'jobId:', analysis.jobId, 'age:', 
      Math.round((Date.now() - analysis.createdAt.getTime()) / 60000), 'min');
  });

  // 6. Test the queue import
  console.log('\n6. Testing queue module import...');
  try {
    const { aiAnalysisQueue } = await import('@/lib/jobs/queue');
    const testQueue = await aiAnalysisQueue;
    console.log('   ✅ Queue imported successfully');
    console.log('   Queue name:', testQueue.name);
  } catch (error: any) {
    console.log('   ❌ Queue import failed:', error.message);
  }

  await queue.close();
  console.log('\n=== TEST COMPLETE ===');
}

testRealFlow().catch(console.error);