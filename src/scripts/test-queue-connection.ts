#!/usr/bin/env node
/**
 * Test BullMQ queue connection
 */

import 'dotenv/config';
import { Queue } from 'bullmq';

async function testQueueConnection() {
  console.log('=== Testing BullMQ Queue Connection ===\n');

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  
  if (!redisUrl) {
    console.error('❌ No Redis URL found');
    return;
  }

  console.log('Redis URL found:', redisUrl.substring(0, 30) + '...');
  console.log('URL type:', redisUrl.startsWith('rediss://') ? 'SSL Redis' : 'Standard Redis');

  try {
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || process.env.KV_REST_API_TOKEN,
      username: url.username || undefined,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    };

    console.log('\nConnection config:');
    console.log('- Host:', connection.host);
    console.log('- Port:', connection.port);
    console.log('- Username:', connection.username || 'default');
    console.log('- TLS:', connection.tls ? 'Enabled' : 'Disabled');

    // Create a test queue
    const testQueue = new Queue('test-queue', { connection });

    // Try to add a job
    console.log('\nTesting queue operations...');
    const job = await testQueue.add('test-job', { test: true });
    console.log('✅ Successfully added job with ID:', job.id);

    // Check queue status
    const counts = await testQueue.getJobCounts();
    console.log('\nQueue counts:', counts);

    // Clean up
    await testQueue.obliterate({ force: true });
    await testQueue.close();

    console.log('\n✅ Queue connection test successful!');

  } catch (error) {
    console.error('\n❌ Queue connection test failed:', error);
  }
}

testQueueConnection().catch(console.error);