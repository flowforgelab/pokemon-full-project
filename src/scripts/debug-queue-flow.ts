#!/usr/bin/env node
/**
 * Debug the entire queue flow systematically
 */

import 'dotenv/config';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { prisma } from '@/server/db/prisma';

const QUEUE_NAME = 'ai-analysis';

async function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || '';
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || process.env.KV_REST_API_TOKEN,
    username: url.username || undefined,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  };
}

async function debugQueueFlow() {
  console.log('=== QUEUE SYSTEM DEBUG ===\n');

  const connection = await getRedisConnection();
  console.log('1. Redis Connection Config:');
  console.log('   Host:', connection.host);
  console.log('   Port:', connection.port);
  console.log('   TLS:', connection.tls ? 'Enabled' : 'Disabled');
  console.log('   Username:', connection.username || 'default');

  // Test 1: Can we connect to Redis?
  console.log('\n2. Testing Redis Connection...');
  try {
    const testQueue = new Queue('test-connection', { connection });
    await testQueue.getJobCounts();
    console.log('   ✅ Redis connection successful');
    await testQueue.obliterate({ force: true });
    await testQueue.close();
  } catch (error: any) {
    console.log('   ❌ Redis connection failed:', error.message);
    return;
  }

  // Test 2: Check the AI analysis queue
  console.log('\n3. Checking AI Analysis Queue...');
  const queue = new Queue(QUEUE_NAME, { connection });
  const counts = await queue.getJobCounts();
  console.log('   Queue counts:', counts);

  // Test 3: Add a test job
  console.log('\n4. Adding Test Job...');
  const testJob = await queue.add('test-debug-job', {
    test: true,
    timestamp: new Date().toISOString(),
    analysisId: 'debug-test-123'
  });
  console.log('   ✅ Test job added with ID:', testJob.id);

  // Test 4: Check if job appears
  console.log('\n5. Verifying Job in Queue...');
  const newCounts = await queue.getJobCounts();
  console.log('   Updated queue counts:', newCounts);
  
  const waitingJobs = await queue.getWaiting(0, 10);
  console.log('   Waiting jobs:', waitingJobs.length);
  if (waitingJobs.length > 0) {
    console.log('   First waiting job:', {
      id: waitingJobs[0].id,
      name: waitingJobs[0].name,
      data: waitingJobs[0].data
    });
  }

  // Test 5: Create a simple worker to process the job
  console.log('\n6. Creating Test Worker...');
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log('   📨 Worker received job:', job.id, job.name);
      return { processed: true, jobId: job.id };
    },
    { connection }
  );

  // Test 6: Listen for events
  console.log('\n7. Setting up Event Listeners...');
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
  
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log('   ✅ Job completed:', jobId, returnvalue);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.log('   ❌ Job failed:', jobId, failedReason);
  });

  // Wait a bit for processing
  console.log('\n8. Waiting for job processing...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 7: Check Analysis records
  console.log('\n9. Checking Analysis Database Records...');
  try {
    const recentAnalyses = await prisma.analysis.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        jobId: true,
        createdAt: true,
        error: true
      }
    });
    console.log('   Recent analyses:', recentAnalyses.map(a => ({
      id: a.id.substring(0, 8),
      status: a.status,
      jobId: a.jobId?.substring(0, 8),
      age: `${Math.round((Date.now() - a.createdAt.getTime()) / 60000)}min ago`
    })));
  } catch (error: any) {
    console.log('   ❌ Database query failed:', error.message);
  }

  // Test 8: Check for stuck jobs
  console.log('\n10. Checking for Stuck Jobs...');
  const activeJobs = await queue.getActive();
  const stalledJobs = await queue.getFailed();
  console.log('   Active jobs:', activeJobs.length);
  console.log('   Failed jobs:', stalledJobs.length);
  
  if (stalledJobs.length > 0) {
    console.log('   Failed job details:');
    stalledJobs.slice(0, 3).forEach(job => {
      console.log('     -', job.id, ':', job.failedReason);
    });
  }

  // Cleanup
  console.log('\n11. Cleaning up test job...');
  await queue.remove(testJob.id);
  await worker.close();
  await queueEvents.close();
  await queue.close();

  console.log('\n=== DEBUG COMPLETE ===');
}

debugQueueFlow().catch(console.error);