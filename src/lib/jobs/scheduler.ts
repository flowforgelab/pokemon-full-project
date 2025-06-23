import { JobQueue, ScheduleConfig } from './types';
import { QueueManager } from './queues';

export interface ScheduledJob {
  id: string;
  name: string;
  queue: JobQueue;
  cron: string;
  description: string;
  enabled: boolean;
  config: ScheduleConfig;
  data?: any;
}

// Define all scheduled jobs
export const scheduledJobs: ScheduledJob[] = [
  {
    id: 'weekly-price-update',
    name: 'Weekly Price Update',
    queue: JobQueue.PRICE_UPDATE,
    cron: '0 2 * * 0', // Every Sunday at 2 AM
    description: 'Update card prices from TCGPlayer API',
    enabled: true,
    config: {
      cron: '0 2 * * 0',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 300000, // 5 minutes
        },
      },
      alertOnFailure: true,
      maintenanceWindow: {
        start: '02:00',
        end: '06:00',
        days: [0], // Sunday only
      },
    },
    data: {
      type: 'incremental',
      validateOnly: false,
    },
  },
  {
    id: 'daily-price-update-popular',
    name: 'Daily Popular Card Price Update',
    queue: JobQueue.PRICE_UPDATE,
    cron: '0 3 * * *', // Every day at 3 AM
    description: 'Update prices for popular and trending cards',
    enabled: true,
    config: {
      cron: '0 3 * * *',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 180000, // 3 minutes
        },
      },
      alertOnFailure: false,
    },
    data: {
      type: 'popular',
      limit: 100,
    },
  },
  {
    id: 'daily-new-set-check',
    name: 'Daily New Set Detection',
    queue: JobQueue.SET_IMPORT,
    cron: '0 4 * * *', // Every day at 4 AM
    description: 'Check for new Pokemon TCG sets',
    enabled: true,
    config: {
      cron: '0 4 * * *',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 60000, // 1 minute
        },
      },
      alertOnFailure: true,
    },
    data: {
      checkOnly: true,
      notifyOnNew: true,
    },
  },
  {
    id: 'weekly-data-validation',
    name: 'Weekly Data Validation',
    queue: JobQueue.DATA_VALIDATION,
    cron: '0 1 * * 1', // Every Monday at 1 AM
    description: 'Validate data integrity across all entities',
    enabled: true,
    config: {
      cron: '0 1 * * 1',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 300000, // 5 minutes
        },
      },
      alertOnFailure: true,
      maintenanceWindow: {
        start: '01:00',
        end: '05:00',
        days: [1], // Monday only
      },
    },
    data: {
      autoFix: true,
      scope: 'all',
      dryRun: false,
    },
  },
  {
    id: 'daily-cleanup',
    name: 'Daily Data Cleanup',
    queue: JobQueue.DATA_CLEANUP,
    cron: '0 5 * * *', // Every day at 5 AM
    description: 'Clean up temporary files and expired data',
    enabled: true,
    config: {
      cron: '0 5 * * *',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 120000, // 2 minutes
        },
      },
      alertOnFailure: false,
    },
    data: {
      tasks: [
        'expired-sessions',
        'temporary-files',
        'stale-cache',
      ],
      dryRun: false,
    },
  },
  {
    id: 'monthly-deep-cleanup',
    name: 'Monthly Deep Cleanup',
    queue: JobQueue.DATA_CLEANUP,
    cron: '0 6 1 * *', // First day of month at 6 AM
    description: 'Deep cleanup including logs and old backups',
    enabled: true,
    config: {
      cron: '0 6 1 * *',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 600000, // 10 minutes
        },
      },
      alertOnFailure: true,
      maintenanceWindow: {
        start: '06:00',
        end: '08:00',
      },
    },
    data: {
      tasks: [
        'soft-deleted-records',
        'old-logs',
        'orphaned-records',
        'old-backups',
        'audit-logs',
      ],
      dryRun: false,
      force: false,
    },
  },
  {
    id: 'daily-backup',
    name: 'Daily Database Backup',
    queue: JobQueue.BACKUP,
    cron: '0 0 * * *', // Every day at midnight
    description: 'Create daily database backup',
    enabled: true,
    config: {
      cron: '0 0 * * *',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 300000, // 5 minutes
        },
      },
      alertOnFailure: true,
    },
    data: {
      type: 'incremental',
      compress: true,
      encrypt: true,
      destinations: [
        {
          type: 's3',
          config: {
            bucket: process.env.BACKUP_S3_BUCKET,
            prefix: 'daily/',
          },
        },
      ],
    },
  },
  {
    id: 'weekly-full-backup',
    name: 'Weekly Full Backup',
    queue: JobQueue.BACKUP,
    cron: '0 23 * * 6', // Every Saturday at 11 PM
    description: 'Create weekly full database backup',
    enabled: true,
    config: {
      cron: '0 23 * * 6',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 600000, // 10 minutes
        },
      },
      alertOnFailure: true,
      maintenanceWindow: {
        start: '23:00',
        end: '02:00',
        days: [6, 0], // Saturday and Sunday
      },
    },
    data: {
      type: 'full',
      compress: true,
      encrypt: true,
      includeUploads: true,
      destinations: [
        {
          type: 's3',
          config: {
            bucket: process.env.BACKUP_S3_BUCKET,
            prefix: 'weekly/',
          },
        },
        {
          type: 'gcs',
          config: {
            bucket: process.env.BACKUP_GCS_BUCKET,
            prefix: 'weekly/',
          },
        },
      ],
    },
  },
  {
    id: 'format-rotation-check',
    name: 'Format Rotation Check',
    queue: JobQueue.FORMAT_ROTATION,
    cron: '0 12 * * *', // Every day at noon
    description: 'Check for format rotation announcements',
    enabled: true,
    config: {
      cron: '0 12 * * *',
      timezone: 'UTC',
      enabled: true,
      retryPolicy: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 60000, // 1 minute
        },
      },
      alertOnFailure: false,
    },
    data: {
      checkOnly: true,
      notifyOnRotation: true,
    },
  },
];

export class JobScheduler {
  private static instance: JobScheduler;
  private scheduledJobIds: Map<string, string> = new Map();

  private constructor() {}

  static getInstance(): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler();
    }
    return JobScheduler.instance;
  }

  /**
   * Initialize all scheduled jobs
   */
  async initialize() {
    console.log('Initializing job scheduler...');

    for (const job of scheduledJobs) {
      if (job.enabled && job.config.enabled) {
        try {
          await this.scheduleJob(job);
          console.log(`Scheduled job: ${job.name} (${job.cron})`);
        } catch (error) {
          console.error(`Failed to schedule job ${job.name}:`, error);
        }
      }
    }

    console.log('Job scheduler initialized');
  }

  /**
   * Schedule a single job
   */
  private async scheduleJob(job: ScheduledJob) {
    // Check maintenance window
    if (this.isInMaintenanceWindow(job.config.maintenanceWindow)) {
      console.log(`Job ${job.name} is in maintenance window, skipping`);
      return;
    }

    const scheduledJob = await QueueManager.scheduleJob(
      job.queue,
      job.id,
      job.data || {},
      job.cron,
      {
        scheduledBy: 'system',
        reason: 'Scheduled job',
      }
    );

    if (scheduledJob?.id) {
      this.scheduledJobIds.set(job.id, scheduledJob.id);
    }
  }

  /**
   * Check if current time is within maintenance window
   */
  private isInMaintenanceWindow(window?: ScheduleConfig['maintenanceWindow']): boolean {
    if (!window) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Check if current day is in maintenance days
    if (window.days && !window.days.includes(currentDay)) {
      return false;
    }

    // Check if current time is within maintenance window
    return currentTime >= window.start && currentTime <= window.end;
  }

  /**
   * Enable a scheduled job
   */
  async enableJob(jobId: string) {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error(`Scheduled job ${jobId} not found`);
    }

    job.enabled = true;
    await this.scheduleJob(job);

    await QueueManager.addJob(
      JobQueue.AUDIT,
      'scheduled-job-enabled',
      {
        jobId,
        enabledAt: new Date(),
      }
    );
  }

  /**
   * Disable a scheduled job
   */
  async disableJob(jobId: string) {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error(`Scheduled job ${jobId} not found`);
    }

    job.enabled = false;
    
    // Remove from queue if scheduled
    const bullJobId = this.scheduledJobIds.get(jobId);
    if (bullJobId) {
      await QueueManager.cancelJob(job.queue, bullJobId, 'Job disabled');
      this.scheduledJobIds.delete(jobId);
    }

    await QueueManager.addJob(
      JobQueue.AUDIT,
      'scheduled-job-disabled',
      {
        jobId,
        disabledAt: new Date(),
      }
    );
  }

  /**
   * Manually trigger a scheduled job
   */
  async triggerJob(jobId: string, data?: any) {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error(`Scheduled job ${jobId} not found`);
    }

    const triggeredJob = await QueueManager.addJob(
      job.queue,
      `${job.id}-manual`,
      data || job.data || {},
      {
        scheduledBy: 'admin',
        reason: 'Manual trigger',
        manual: true,
      }
    );

    await QueueManager.addJob(
      JobQueue.AUDIT,
      'scheduled-job-triggered',
      {
        jobId,
        triggeredJobId: triggeredJob.id,
        triggeredAt: new Date(),
      }
    );

    return triggeredJob.id;
  }

  /**
   * Get status of all scheduled jobs
   */
  async getJobStatuses() {
    const statuses = await Promise.all(
      scheduledJobs.map(async (job) => {
        const bullJobId = this.scheduledJobIds.get(job.id);
        let status = null;

        if (bullJobId) {
          try {
            status = await QueueManager.getJobStatus(job.queue, bullJobId);
          } catch (error) {
            console.error(`Failed to get status for job ${job.id}:`, error);
          }
        }

        return {
          ...job,
          status,
          isScheduled: !!bullJobId,
        };
      })
    );

    return statuses;
  }

  /**
   * Update job configuration
   */
  async updateJobConfig(jobId: string, config: Partial<ScheduleConfig>) {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error(`Scheduled job ${jobId} not found`);
    }

    // Update config
    job.config = { ...job.config, ...config };

    // Reschedule if enabled
    if (job.enabled && job.config.enabled) {
      const bullJobId = this.scheduledJobIds.get(jobId);
      if (bullJobId) {
        await QueueManager.cancelJob(job.queue, bullJobId, 'Config updated');
        this.scheduledJobIds.delete(jobId);
      }
      await this.scheduleJob(job);
    }

    await QueueManager.addJob(
      JobQueue.AUDIT,
      'scheduled-job-config-updated',
      {
        jobId,
        config,
        updatedAt: new Date(),
      }
    );
  }
}

// Export singleton instance
export const jobScheduler = JobScheduler.getInstance();