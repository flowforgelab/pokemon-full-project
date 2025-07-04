#!/usr/bin/env node
/**
 * Check the completed analysis details
 */

import 'dotenv/config';
import { prisma } from '@/server/db/prisma';

async function checkCompletedAnalysis() {
  console.log('=== CHECKING COMPLETED ANALYSIS ===\n');

  // Get the completed analysis
  const analysis = await prisma.analysis.findUnique({
    where: { id: 'b7270cec-da3e-4654-a97a-cef2f3b0feb9' },
    include: {
      deck: {
        select: { name: true }
      }
    }
  });

  if (!analysis) {
    console.log('Analysis not found');
    return;
  }

  console.log('Analysis Details:');
  console.log('- ID:', analysis.id);
  console.log('- Status:', analysis.status);
  console.log('- Deck:', analysis.deck.name);
  console.log('- Model:', analysis.model);
  console.log('- Job ID:', analysis.jobId);
  console.log('- Created:', analysis.createdAt);
  console.log('- Started:', analysis.startedAt);
  console.log('- Completed:', analysis.completedAt);
  
  const duration = analysis.startedAt && analysis.completedAt 
    ? (analysis.completedAt.getTime() - analysis.startedAt.getTime()) / 1000
    : 0;
  console.log('- Duration:', duration, 'seconds');

  console.log('\nResult:');
  if (analysis.result) {
    console.log(JSON.stringify(analysis.result, null, 2));
  } else {
    console.log('No result data');
  }

  if (analysis.error) {
    console.log('\nError:', analysis.error);
  }
}

checkCompletedAnalysis().catch(console.error);