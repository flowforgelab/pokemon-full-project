import { createWorker } from '../queue';
import { processPriceUpdateJob } from './price-update';
import { processSetImportJob } from './set-import';
import { processCardSyncJob } from './card-sync';
import { processDataCleanupJob } from './data-cleanup';
import { processReportJob } from './report-generator';
import type { Worker } from 'bullmq';

// Worker instances
let priceUpdateWorker: Worker | null = null;
let setImportWorker: Worker | null = null;
let cardSyncWorker: Worker | null = null;
let dataCleanupWorker: Worker | null = null;
let reportWorker: Worker | null = null;

// Start all workers
export async function startAllWorkers(): Promise<void> {
  console.log('Starting all job workers...');
  
  // Create workers asynchronously
  const [priceWorker, setWorker, syncWorker, cleanupWorker, reportW] = await Promise.all([
    createWorker('price-updates', processPriceUpdateJob, 2),
    createWorker('set-imports', processSetImportJob, 1),
    createWorker('card-sync', processCardSyncJob, 1),
    createWorker('data-cleanup', processDataCleanupJob, 1),
    createWorker('reports', processReportJob, 1),
  ]);
  
  priceUpdateWorker = priceWorker;
  setImportWorker = setWorker;
  cardSyncWorker = syncWorker;
  dataCleanupWorker = cleanupWorker;
  reportWorker = reportW;
  
  console.log('All job workers started');
}

// Stop all workers
export async function stopAllWorkers(): Promise<void> {
  console.log('Stopping all job workers...');
  
  const workers = [
    priceUpdateWorker,
    setImportWorker,
    cardSyncWorker,
    dataCleanupWorker,
    reportWorker,
  ].filter(Boolean);
  
  await Promise.all(workers.map(worker => worker!.close()));
  
  console.log('All job workers stopped');
}