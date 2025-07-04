#!/usr/bin/env node
/**
 * Check the status of analyses and queue jobs
 */

import 'dotenv/config';
import { prisma } from '@/server/db/prisma';
import { createDirectQueue } from '@/lib/jobs/direct-queue';

async function checkAnalysisStatus() {
  console.log('=== ANALYSIS STATUS CHECK ===\n');

  // 1. Check recent analyses
  console.log('1. Recent Analyses in Database:');
  const analyses = await prisma.analysis.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      jobId: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      error: true,
      model: true,
      deck: {
        select: { name: true }
      }
    }
  });

  analyses.forEach(analysis => {
    const age = Math.round((Date.now() - analysis.createdAt.getTime()) / 1000);
    console.log(`\n  Analysis ${analysis.id.substring(0, 8)}:`);
    console.log(`  - Deck: ${analysis.deck.name}`);
    console.log(`  - Status: ${analysis.status}`);
    console.log(`  - JobId: ${analysis.jobId}`);
    console.log(`  - Model: ${analysis.model}`);
    console.log(`  - Created: ${age}s ago`);
    if (analysis.startedAt) {
      console.log(`  - Started: ${new Date(analysis.startedAt).toISOString()}`);
    }
    if (analysis.completedAt) {
      console.log(`  - Completed: ${new Date(analysis.completedAt).toISOString()}`);
    }
    if (analysis.error) {
      console.log(`  - Error: ${analysis.error.substring(0, 100)}...`);
    }
  });

  // 2. Check queue status
  console.log('\n\n2. Queue Status:');
  try {
    const queue = createDirectQueue('ai-analysis');
    const counts = await queue.getJobCounts();
    console.log('  Job counts:', counts);

    // Get waiting jobs
    if (counts.waiting > 0) {
      const waitingJobs = await queue.getWaiting(0, 5);
      console.log('\n  Waiting Jobs:');
      waitingJobs.forEach(job => {
        console.log(`  - Job ${job.id}: ${job.name}`);
        console.log(`    AnalysisId: ${job.data.analysisId?.substring(0, 8)}`);
        console.log(`    Created: ${new Date(job.timestamp).toISOString()}`);
      });
    }

    // Get active jobs
    if (counts.active > 0) {
      const activeJobs = await queue.getActive(0, 5);
      console.log('\n  Active Jobs:');
      activeJobs.forEach(job => {
        console.log(`  - Job ${job.id}: ${job.name}`);
        console.log(`    AnalysisId: ${job.data.analysisId?.substring(0, 8)}`);
      });
    }

    // Get completed jobs
    if (counts.completed > 0) {
      const completedJobs = await queue.getCompleted(0, 5);
      console.log('\n  Recently Completed Jobs:');
      completedJobs.forEach(job => {
        console.log(`  - Job ${job.id}: ${job.name}`);
        console.log(`    AnalysisId: ${job.data.analysisId?.substring(0, 8)}`);
        console.log(`    Completed: ${new Date(job.finishedOn || 0).toISOString()}`);
      });
    }

    // Get failed jobs
    if (counts.failed > 0) {
      const failedJobs = await queue.getFailed(0, 5);
      console.log('\n  Failed Jobs:');
      failedJobs.forEach(job => {
        console.log(`  - Job ${job.id}: ${job.name}`);
        console.log(`    AnalysisId: ${job.data.analysisId?.substring(0, 8)}`);
        console.log(`    Failed: ${job.failedReason}`);
      });
    }

    await queue.close();
  } catch (error) {
    console.error('  Error checking queue:', error);
  }

  // 3. Check for stuck analyses
  console.log('\n\n3. Potentially Stuck Analyses:');
  const stuckAnalyses = await prisma.analysis.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) }, // Older than 2 minutes
      jobId: { not: { startsWith: 'mock' } }
    },
    select: {
      id: true,
      jobId: true,
      createdAt: true,
      deck: { select: { name: true } }
    }
  });

  if (stuckAnalyses.length > 0) {
    console.log(`  Found ${stuckAnalyses.length} stuck analyses:`);
    stuckAnalyses.forEach(analysis => {
      const age = Math.round((Date.now() - analysis.createdAt.getTime()) / 60000);
      console.log(`  - ${analysis.id.substring(0, 8)}: ${analysis.deck.name} (${age} min old, job: ${analysis.jobId})`);
    });
  } else {
    console.log('  No stuck analyses found');
  }

  console.log('\n=== CHECK COMPLETE ===');
}

checkAnalysisStatus().catch(console.error);