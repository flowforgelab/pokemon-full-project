// This file wraps queue imports to prevent them from being loaded during build
// It provides a clean separation between build-time and runtime code

import type { JobData, JobResult } from '@/lib/api/types';

// Check if we're in a build environment
const IS_BUILD = process.env.NODE_ENV === 'production' && 
  (!process.env.KV_REST_API_URL || process.env.VERCEL_ENV === 'production' || process.env.BUILDING === 'true');

// During build, export dummy functions that won't trigger imports
if (IS_BUILD) {
  console.log('Build environment detected - using mock queues');
  
  const mockQueue = {
    add: async () => ({ id: 'mock' }),
    addBulk: async () => [],
    getWaitingCount: async () => 0,
    getActiveCount: async () => 0,
    getCompletedCount: async () => 0,
    getFailedCount: async () => 0,
    getDelayedCount: async () => 0,
    isPaused: async () => false,
    pause: async () => {},
    resume: async () => {},
    clean: async () => {},
    obliterate: async () => {},
    close: async () => {},
    name: 'mock-queue',
  };

  const mockQueuePromise = Promise.resolve(mockQueue);

  module.exports = {
    priceUpdateQueue: mockQueuePromise,
    setImportQueue: mockQueuePromise,
    cardSyncQueue: mockQueuePromise,
    dataCleanupQueue: mockQueuePromise,
    reportQueue: mockQueuePromise,
    collectionIndexQueue: mockQueuePromise,
    pokemonTCGQueue: mockQueuePromise,
    priceUpdateEvents: mockQueuePromise,
    setImportEvents: mockQueuePromise,
    cardSyncEvents: mockQueuePromise,
    scheduleRecurringJobs: async () => {
      console.log('Skipping job scheduling in build environment');
    },
    createWorker: async () => null,
    getQueueStats: async () => ({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
    }),
    getAllQueuesStats: async () => ({}),
    addPriorityJob: async () => ({ id: 'mock' }),
    addBulkJobs: async () => [],
    clearQueue: async () => {},
    pauseQueue: async () => {},
    resumeQueue: async () => {},
    setupJobEventListeners: () => {},
    retryConfigs: {},
    JobPriority: {
      LOW: 10,
      NORMAL: 0,
      HIGH: -10,
      CRITICAL: -20,
    },
  };
} else {
  // Runtime environment - use actual queue module
  console.log('Runtime environment detected - loading real queues');
  module.exports = require('./queue');
}