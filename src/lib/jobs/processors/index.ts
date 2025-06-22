import { createWorker } from '../queue';
import { processPriceUpdateJob } from './price-update';
import { processSetImportJob } from './set-import';
import { processCardSyncJob } from './card-sync';
import { processDataCleanupJob } from './data-cleanup';
import { processReportJob } from './report-generator';

// Create and export workers
export const priceUpdateWorker = createWorker('price-updates', processPriceUpdateJob, 2);
export const setImportWorker = createWorker('set-imports', processSetImportJob, 1);
export const cardSyncWorker = createWorker('card-sync', processCardSyncJob, 1);
export const dataCleanupWorker = createWorker('data-cleanup', processDataCleanupJob, 1);
export const reportWorker = createWorker('reports', processReportJob, 1);

// Start all workers
export function startAllWorkers(): void {
  console.log('Starting all job workers...');
  
  // Workers are automatically started when created
  // This function is here for explicit initialization if needed
  
  console.log('All job workers started');
}

// Stop all workers
export async function stopAllWorkers(): Promise<void> {
  console.log('Stopping all job workers...');
  
  await Promise.all([
    priceUpdateWorker.close(),
    setImportWorker.close(),
    cardSyncWorker.close(),
    dataCleanupWorker.close(),
    reportWorker.close(),
  ]);
  
  console.log('All job workers stopped');
}