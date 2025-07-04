#!/usr/bin/env node
/**
 * Find completed analyses
 */

import 'dotenv/config';
import { prisma } from '@/server/db/prisma';

async function findCompletedAnalysis() {
  console.log('=== FINDING COMPLETED ANALYSES ===\n');

  const completedAnalyses = await prisma.analysis.findMany({
    where: { status: 'COMPLETED' },
    include: {
      deck: {
        select: { name: true }
      }
    },
    orderBy: { completedAt: 'desc' },
    take: 5
  });

  console.log(`Found ${completedAnalyses.length} completed analyses:\n`);

  for (const analysis of completedAnalyses) {
    console.log(`Analysis: ${analysis.id}`);
    console.log('- Deck:', analysis.deck.name);
    console.log('- Job ID:', analysis.jobId);
    console.log('- Model:', analysis.model);
    console.log('- Completed:', analysis.completedAt);
    console.log('- Has result:', !!analysis.result);
    
    if (analysis.result) {
      const result = analysis.result as any;
      console.log('- Score:', result.score);
      console.log('- Executive Summary:', result.executiveSummary?.substring(0, 100) + '...');
      console.log('\nFull result:');
      console.log(JSON.stringify(result, null, 2));
    }
    
    console.log('---\n');
  }
}

findCompletedAnalysis().catch(console.error);