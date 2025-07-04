#!/usr/bin/env node
/**
 * Debug why the queue module might be using MockQueue
 */

import 'dotenv/config';

async function debugQueueModule() {
  console.log('=== QUEUE MODULE DEBUG ===\n');

  console.log('1. Environment Variables:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('   BUILDING:', process.env.BUILDING);
  console.log('   KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'Set' : 'Not set');
  console.log('   REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
  console.log('   KV_URL:', process.env.KV_URL ? 'Set' : 'Not set');

  console.log('\n2. IS_BUILD Calculation:');
  const IS_BUILD = process.env.NODE_ENV === 'production' && (!process.env.KV_REST_API_URL || process.env.VERCEL_ENV === 'production');
  console.log('   NODE_ENV === "production":', process.env.NODE_ENV === 'production');
  console.log('   !KV_REST_API_URL:', !process.env.KV_REST_API_URL);
  console.log('   VERCEL_ENV === "production":', process.env.VERCEL_ENV === 'production');
  console.log('   IS_BUILD result:', IS_BUILD);

  console.log('\n3. Testing Queue Import:');
  const { aiAnalysisQueue } = await import('@/lib/jobs/queue');
  const queue = await aiAnalysisQueue;
  
  console.log('   Queue type:', queue.constructor.name);
  console.log('   Is MockQueue?:', queue.constructor.name === 'MockQueue');
  console.log('   Queue name:', queue.name);
  
  // Try to add a job
  console.log('\n4. Testing Job Addition:');
  const job = await queue.add('test-job', { test: true });
  console.log('   Job ID:', job.id);
  console.log('   Is mock job?:', job.id === 'mock');

  console.log('\n=== DEBUG COMPLETE ===');
}

debugQueueModule().catch(console.error);