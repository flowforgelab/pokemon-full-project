import { JobQueue, DataValidationJobData, DataCleanupJobData, CleanupTask, JobPriority } from '../types';
import { QueueManager } from '../queues';
import { redisCache } from '@/lib/cache/redis-cache';

export class DataMaintenanceService {
  /**
   * Run data validation
   */
  async runValidation(options?: {
    rules?: string[];
    autoFix?: boolean;
    scope?: 'all' | 'cards' | 'decks' | 'collections' | 'users' | 'prices';
    dryRun?: boolean;
  }): Promise<string> {
    const jobData: DataValidationJobData = {
      rules: options?.rules,
      autoFix: options?.autoFix ?? false,
      scope: options?.scope ?? 'all',
      dryRun: options?.dryRun ?? false,
    };

    const job = await QueueManager.addJob(
      JobQueue.DATA_VALIDATION,
      'data-validation',
      jobData,
      {
        priority: JobPriority.NORMAL,
        scheduledBy: 'admin',
        reason: 'Manual data validation',
      }
    );

    return job.id!;
  }

  /**
   * Run data cleanup
   */
  async runCleanup(options?: {
    tasks?: CleanupTask[];
    dryRun?: boolean;
    force?: boolean;
  }): Promise<string> {
    const jobData: DataCleanupJobData = {
      tasks: options?.tasks,
      dryRun: options?.dryRun ?? true,
      force: options?.force ?? false,
    };

    const job = await QueueManager.addJob(
      JobQueue.DATA_CLEANUP,
      'data-cleanup',
      jobData,
      {
        priority: JobPriority.LOW,
        scheduledBy: 'admin',
        reason: 'Manual data cleanup',
      }
    );

    return job.id!;
  }

  /**
   * Schedule recurring validation
   */
  async scheduleValidation(cron: string, rules: string[]): Promise<void> {
    await QueueManager.scheduleJob(
      JobQueue.DATA_VALIDATION,
      'scheduled-validation',
      {
        rules,
        autoFix: true,
        scope: 'all',
        dryRun: false,
      },
      cron,
      {
        scheduledBy: 'system',
        reason: 'Scheduled validation',
      }
    );
  }

  /**
   * Get validation report
   */
  async getValidationReport(jobId: string): Promise<any> {
    const reportKey = `validation:report:${jobId}`;
    const report = await redisCache.get(reportKey);
    
    if (!report) {
      // Try to get from job result
      const job = await QueueManager.getJobStatus(JobQueue.DATA_VALIDATION, jobId);
      if (job && job.state === 'completed') {
        return job.data;
      }
      return null;
    }

    return JSON.parse(report);
  }

  /**
   * Get cleanup summary
   */
  async getCleanupSummary(jobId: string): Promise<any> {
    const summaryKey = `cleanup:summary:${jobId}`;
    const summary = await redisCache.get(summaryKey);
    
    if (!summary) {
      const job = await QueueManager.getJobStatus(JobQueue.DATA_CLEANUP, jobId);
      if (job && job.state === 'completed') {
        return job.data;
      }
      return null;
    }

    return JSON.parse(summary);
  }

  /**
   * Get available validation rules
   */
  getAvailableValidationRules(): Array<{
    name: string;
    description: string;
    severity: string;
    autoFixAvailable: boolean;
  }> {
    return [
      {
        name: 'card-set-reference',
        description: 'Validate all cards have valid set references',
        severity: 'error',
        autoFixAvailable: true,
      },
      {
        name: 'card-images',
        description: 'Validate card image URLs',
        severity: 'warning',
        autoFixAvailable: false,
      },
      {
        name: 'price-anomaly',
        description: 'Detect unusual price changes',
        severity: 'warning',
        autoFixAvailable: false,
      },
      {
        name: 'orphaned-deck-cards',
        description: 'Find deck cards without valid card references',
        severity: 'error',
        autoFixAvailable: true,
      },
      {
        name: 'deck-size',
        description: 'Validate deck sizes match format requirements',
        severity: 'warning',
        autoFixAvailable: false,
      },
      {
        name: 'collection-integrity',
        description: 'Validate user collection data integrity',
        severity: 'error',
        autoFixAvailable: false,
      },
      {
        name: 'duplicate-cards',
        description: 'Detect duplicate card entries',
        severity: 'error',
        autoFixAvailable: true,
      },
      {
        name: 'user-data-integrity',
        description: 'Validate user account data',
        severity: 'error',
        autoFixAvailable: false,
      },
      {
        name: 'foreign-key-constraints',
        description: 'Validate all foreign key relationships',
        severity: 'error',
        autoFixAvailable: false,
      },
      {
        name: 'data-consistency',
        description: 'Check data consistency across related tables',
        severity: 'warning',
        autoFixAvailable: false,
      },
    ];
  }

  /**
   * Get available cleanup tasks
   */
  getAvailableCleanupTasks(): Array<{
    task: CleanupTask;
    description: string;
    defaultRetention?: string;
  }> {
    return [
      {
        task: CleanupTask.SOFT_DELETED_RECORDS,
        description: 'Clean up soft-deleted records',
        defaultRetention: '30 days',
      },
      {
        task: CleanupTask.EXPIRED_SESSIONS,
        description: 'Remove expired authentication sessions',
        defaultRetention: '24 hours',
      },
      {
        task: CleanupTask.TEMPORARY_FILES,
        description: 'Delete temporary upload and export files',
        defaultRetention: '24 hours',
      },
      {
        task: CleanupTask.OLD_LOGS,
        description: 'Archive and remove old log files',
        defaultRetention: '90 days',
      },
      {
        task: CleanupTask.STALE_CACHE,
        description: 'Clear stale cache entries',
        defaultRetention: '30 days',
      },
      {
        task: CleanupTask.ORPHANED_RECORDS,
        description: 'Remove orphaned database records',
        defaultRetention: 'immediate',
      },
      {
        task: CleanupTask.OLD_BACKUPS,
        description: 'Clean up old backup files',
        defaultRetention: '30 days',
      },
      {
        task: CleanupTask.AUDIT_LOGS,
        description: 'Archive old audit logs',
        defaultRetention: '1 year',
      },
    ];
  }

  /**
   * Get maintenance statistics
   */
  async getMaintenanceStats(): Promise<{
    lastValidation: Date | null;
    lastCleanup: Date | null;
    totalIssuesFound: number;
    totalIssuesFixed: number;
    totalSpaceReclaimed: number;
  }> {
    // Get recent validation jobs
    const validationJobs = await redisCache.keys('validation:report:*');
    let lastValidation: Date | null = null;
    let totalIssuesFound = 0;
    let totalIssuesFixed = 0;

    for (const key of validationJobs.slice(0, 10)) {
      const report = await redisCache.get(key);
      if (report) {
        const data = JSON.parse(report);
        if (!lastValidation || new Date(data.timestamp) > lastValidation) {
          lastValidation = new Date(data.timestamp);
        }
        totalIssuesFound += data.issuesFound || 0;
        totalIssuesFixed += data.issuesFixed || 0;
      }
    }

    // Get recent cleanup jobs
    const cleanupJobs = await redisCache.keys('cleanup:summary:*');
    let lastCleanup: Date | null = null;
    let totalSpaceReclaimed = 0;

    for (const key of cleanupJobs.slice(0, 10)) {
      const summary = await redisCache.get(key);
      if (summary) {
        const data = JSON.parse(summary);
        if (!lastCleanup || new Date(data.timestamp) > lastCleanup) {
          lastCleanup = new Date(data.timestamp);
        }
        totalSpaceReclaimed += data.spaceReclaimed || 0;
      }
    }

    return {
      lastValidation,
      lastCleanup,
      totalIssuesFound,
      totalIssuesFixed,
      totalSpaceReclaimed,
    };
  }
}

// Export singleton instance
export const dataMaintenanceService = new DataMaintenanceService();