/**
 * Start all job workers for background processing
 */

import { aiAnalysisProcessor } from '@/lib/jobs/processors/ai-analysis-processor';
import { startAllWorkers } from '@/lib/jobs/processors';

async function startWorkers() {
  console.log('Starting job workers...\n');

  try {
    // Initialize the AI analysis processor
    console.log('Starting AI Analysis processor...');
    await aiAnalysisProcessor.initialize();
    console.log('✅ AI Analysis processor started');

    // Start other workers
    console.log('\nStarting other workers...');
    await startAllWorkers();
    console.log('✅ All workers started successfully');

    // Keep the process running
    console.log('\n🚀 Workers are running. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down workers...');
      await aiAnalysisProcessor.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\nShutting down workers...');
      await aiAnalysisProcessor.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}

// Run the workers
startWorkers().catch(console.error);