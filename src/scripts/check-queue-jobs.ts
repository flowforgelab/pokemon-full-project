#!/usr/bin/env node
/**
 * Check jobs in the AI analysis queue
 */

import 'dotenv/config';
import { Queue } from 'bullmq';

async function checkQueue() {
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  
  if (!redisUrl) {
    console.error('No Redis URL found');
    return;
  }

  console.log('Connecting to Redis...');
  
  try {
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || process.env.KV_REST_API_TOKEN,
      username: url.username || undefined,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    };

    const queue = new Queue('ai-analysis', { connection });
    
    // Get job counts
    const counts = await queue.getJobCounts();
    console.log('\nQueue Status:');
    console.log('- Waiting:', counts.waiting);
    console.log('- Active:', counts.active);
    console.log('- Completed:', counts.completed);
    console.log('- Failed:', counts.failed);
    console.log('- Delayed:', counts.delayed);
    console.log('- Paused:', counts.paused);
    
    // Get waiting jobs
    if (counts.waiting > 0) {
      const waitingJobs = await queue.getWaiting(0, 10);
      console.log('\nWaiting Jobs:');
      waitingJobs.forEach(job => {
        console.log(`- Job ${job.id}: Created ${new Date(job.timestamp).toISOString()}`);
        console.log(`  Data:`, JSON.stringify(job.data, null, 2).substring(0, 200));
      });
    }
    
    // Get active jobs
    if (counts.active > 0) {
      const activeJobs = await queue.getActive(0, 10);
      console.log('\nActive Jobs:');
      activeJobs.forEach(job => {
        console.log(`- Job ${job.id}: Started processing`);
      });
    }
    
    // Get failed jobs
    if (counts.failed > 0) {
      const failedJobs = await queue.getFailed(0, 10);
      console.log('\nFailed Jobs:');
      failedJobs.forEach(job => {
        console.log(`- Job ${job.id}: Failed`);
        console.log(`  Reason:`, job.failedReason);
      });
    }
    
    await queue.close();
    
  } catch (error) {
    console.error('Error checking queue:', error);
  }
}

checkQueue().catch(console.error);