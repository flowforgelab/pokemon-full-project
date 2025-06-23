import { Worker, Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { redisCache } from '@/server/db/redis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  DataCleanupJobData,
  DataCleanupResult,
  CleanupTask,
  JobQueue
} from '../types';

interface CleanupTaskHandler {
  task: CleanupTask;
  description: string;
  handler: (dryRun: boolean) => Promise<CleanupTaskResult>;
}

interface CleanupTaskResult {
  recordsDeleted: number;
  spaceReclaimed: number;
  details?: any;
}

export class DataCleanupProcessor {
  private worker: Worker;
  private tasks: Map<CleanupTask, CleanupTaskHandler> = new Map();
  
  constructor() {
    this.worker = new Worker(
      JobQueue.DATA_CLEANUP,
      this.process.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 1,
      }
    );

    this.initializeTasks();
    this.setupEventHandlers();
  }

  private initializeTasks() {
    this.tasks.set(CleanupTask.SOFT_DELETED_RECORDS, {
      task: CleanupTask.SOFT_DELETED_RECORDS,
      description: 'Clean up soft-deleted records',
      handler: this.cleanupSoftDeletedRecords.bind(this),
    });

    this.tasks.set(CleanupTask.EXPIRED_SESSIONS, {
      task: CleanupTask.EXPIRED_SESSIONS,
      description: 'Remove expired authentication sessions',
      handler: this.cleanupExpiredSessions.bind(this),
    });

    this.tasks.set(CleanupTask.TEMPORARY_FILES, {
      task: CleanupTask.TEMPORARY_FILES,
      description: 'Delete temporary upload and export files',
      handler: this.cleanupTemporaryFiles.bind(this),
    });

    this.tasks.set(CleanupTask.OLD_LOGS, {
      task: CleanupTask.OLD_LOGS,
      description: 'Archive and remove old log files',
      handler: this.cleanupOldLogs.bind(this),
    });

    this.tasks.set(CleanupTask.STALE_CACHE, {
      task: CleanupTask.STALE_CACHE,
      description: 'Clear stale cache entries',
      handler: this.cleanupStaleCache.bind(this),
    });

    this.tasks.set(CleanupTask.ORPHANED_RECORDS, {
      task: CleanupTask.ORPHANED_RECORDS,
      description: 'Remove orphaned database records',
      handler: this.cleanupOrphanedRecords.bind(this),
    });

    this.tasks.set(CleanupTask.OLD_BACKUPS, {
      task: CleanupTask.OLD_BACKUPS,
      description: 'Clean up old backup files',
      handler: this.cleanupOldBackups.bind(this),
    });

    this.tasks.set(CleanupTask.AUDIT_LOGS, {
      task: CleanupTask.AUDIT_LOGS,
      description: 'Archive old audit logs',
      handler: this.cleanupAuditLogs.bind(this),
    });
  }

  private async process(job: Job<DataCleanupJobData>): Promise<DataCleanupResult> {
    const startTime = Date.now();
    const errors: Array<{ task: string; error: string }> = [];
    const summary: Record<CleanupTask, { recordsDeleted: number; spaceReclaimed: number }> = {} as any;
    
    try {
      await job.log(`Starting data cleanup: dryRun=${job.data.dryRun}`);

      // Get tasks to run
      const tasksToRun = job.data.tasks || Object.values(CleanupTask);
      let tasksCompleted = 0;
      let totalRecordsDeleted = 0;
      let totalSpaceReclaimed = 0;

      for (const taskName of tasksToRun) {
        const taskHandler = this.tasks.get(taskName);
        
        if (!taskHandler) {
          await job.log(`Unknown task: ${taskName}`);
          continue;
        }

        try {
          await job.log(`Running task: ${taskHandler.description}`);
          
          const result = await taskHandler.handler(job.data.dryRun || false);
          
          summary[taskName] = {
            recordsDeleted: result.recordsDeleted,
            spaceReclaimed: result.spaceReclaimed,
          };

          totalRecordsDeleted += result.recordsDeleted;
          totalSpaceReclaimed += result.spaceReclaimed;
          
          await job.log(
            `Task ${taskName} completed: ${result.recordsDeleted} records deleted, ` +
            `${this.formatBytes(result.spaceReclaimed)} reclaimed`
          );

          tasksCompleted++;
          const progress = Math.floor((tasksCompleted / tasksToRun.length) * 100);
          await job.updateProgress(progress);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ task: taskName, error: errorMessage });
          await job.log(`Task ${taskName} failed: ${errorMessage}`);
        }
      }

      await job.log(
        `Cleanup completed: ${totalRecordsDeleted} records deleted, ` +
        `${this.formatBytes(totalSpaceReclaimed)} reclaimed`
      );

      return {
        tasksCompleted,
        recordsDeleted: totalRecordsDeleted,
        spaceReclaimed: totalSpaceReclaimed,
        errors,
        summary,
      };

    } catch (error) {
      await job.log(`Fatal error in data cleanup: ${error}`);
      throw error;
    }
  }

  // Cleanup Task Implementations

  private async cleanupSoftDeletedRecords(dryRun: boolean): Promise<CleanupTaskResult> {
    const retentionDays = 30; // Keep soft-deleted records for 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Count records to delete
    const deckCount = await prisma.deck.count({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });

    const collectionCount = await prisma.userCollection.count({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });

    const totalRecords = deckCount + collectionCount;

    if (!dryRun && totalRecords > 0) {
      // Delete old soft-deleted decks
      await prisma.deck.deleteMany({
        where: {
          deletedAt: { not: null, lt: cutoffDate },
        },
      });

      // Delete old soft-deleted collection items
      await prisma.userCollection.deleteMany({
        where: {
          deletedAt: { not: null, lt: cutoffDate },
        },
      });
    }

    // Estimate space (rough estimate: 1KB per record)
    const spaceReclaimed = totalRecords * 1024;

    return {
      recordsDeleted: totalRecords,
      spaceReclaimed,
      details: {
        decks: deckCount,
        collectionItems: collectionCount,
      },
    };
  }

  private async cleanupExpiredSessions(dryRun: boolean): Promise<CleanupTaskResult> {
    // Sessions are managed by Clerk, but we might have session-related data
    // For now, clean up any custom session data older than 24 hours
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Example: Clean up temporary auth tokens or session data
    // This would depend on your specific session implementation
    
    return {
      recordsDeleted: 0,
      spaceReclaimed: 0,
    };
  }

  private async cleanupTemporaryFiles(dryRun: boolean): Promise<CleanupTaskResult> {
    const tempDir = process.env.TEMP_DIR || '/tmp/pokemon-tcg';
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let filesDeleted = 0;
    let spaceReclaimed = 0;

    try {
      // Check if temp directory exists
      const dirExists = await fs.stat(tempDir).catch(() => null);
      if (!dirExists) {
        return { recordsDeleted: 0, spaceReclaimed: 0 };
      }

      const files = await fs.readdir(tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          if (!dryRun) {
            await fs.unlink(filePath);
          }
          filesDeleted++;
          spaceReclaimed += stats.size;
        }
      }
    } catch (error) {
      console.error('Error cleaning temporary files:', error);
    }

    return {
      recordsDeleted: filesDeleted,
      spaceReclaimed,
    };
  }

  private async cleanupOldLogs(dryRun: boolean): Promise<CleanupTaskResult> {
    const logRetentionDays = 90; // Keep logs for 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - logRetentionDays);

    // Clean up old job logs from Redis
    const keys = await redisCache.keys('job:log:*');
    let logsDeleted = 0;
    let spaceReclaimed = 0;

    for (const key of keys) {
      const logData = await redisCache.get(key);
      if (logData) {
        const log = JSON.parse(logData);
        if (new Date(log.timestamp) < cutoffDate) {
          if (!dryRun) {
            await redisCache.delete(key);
          }
          logsDeleted++;
          spaceReclaimed += logData.length;
        }
      }
    }

    // Archive old audit logs
    const oldAuditLogs = await prisma.auditLog.count({
      where: { createdAt: { lt: cutoffDate } },
    });

    if (!dryRun && oldAuditLogs > 0) {
      // In production, you'd archive these to S3 or similar before deleting
      // For now, just delete them
      await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });
    }

    return {
      recordsDeleted: logsDeleted + oldAuditLogs,
      spaceReclaimed: spaceReclaimed + (oldAuditLogs * 512), // Estimate 512 bytes per audit log
    };
  }

  private async cleanupStaleCache(dryRun: boolean): Promise<CleanupTaskResult> {
    let keysDeleted = 0;
    let spaceReclaimed = 0;

    // Get all cache keys
    const patterns = [
      'card:*',
      'search:*',
      'price:*',
      'collection:*',
      'analysis:*',
    ];

    for (const pattern of patterns) {
      const keys = await redisCache.keys(pattern);
      
      for (const key of keys) {
        const ttl = await redisCache.ttl(key);
        
        // If TTL is -1 (no expiration) or very high, consider it stale
        if (ttl === -1 || ttl > 86400 * 30) { // 30 days
          const value = await redisCache.get(key);
          if (!dryRun) {
            await redisCache.delete(key);
          }
          keysDeleted++;
          spaceReclaimed += value ? value.length : 0;
        }
      }
    }

    return {
      recordsDeleted: keysDeleted,
      spaceReclaimed,
    };
  }

  private async cleanupOrphanedRecords(dryRun: boolean): Promise<CleanupTaskResult> {
    let recordsDeleted = 0;

    // Clean up deck cards without valid deck references
    const orphanedDeckCards = await prisma.deckCard.count({
      where: { deck: null },
    });

    if (!dryRun && orphanedDeckCards > 0) {
      await prisma.deckCard.deleteMany({
        where: { deck: null },
      });
    }
    recordsDeleted += orphanedDeckCards;

    // Clean up user collections without valid user references
    const orphanedCollections = await prisma.userCollection.count({
      where: { user: null },
    });

    if (!dryRun && orphanedCollections > 0) {
      await prisma.userCollection.deleteMany({
        where: { user: null },
      });
    }
    recordsDeleted += orphanedCollections;

    // Clean up price history without valid card references
    const orphanedPrices = await prisma.priceHistory.count({
      where: { card: null },
    });

    if (!dryRun && orphanedPrices > 0) {
      await prisma.priceHistory.deleteMany({
        where: { card: null },
      });
    }
    recordsDeleted += orphanedPrices;

    return {
      recordsDeleted,
      spaceReclaimed: recordsDeleted * 256, // Estimate 256 bytes per record
    };
  }

  private async cleanupOldBackups(dryRun: boolean): Promise<CleanupTaskResult> {
    const backupRetentionDays = 30; // Keep backups for 30 days
    const backupDir = process.env.BACKUP_DIR || '/backups';
    let filesDeleted = 0;
    let spaceReclaimed = 0;

    try {
      const dirExists = await fs.stat(backupDir).catch(() => null);
      if (!dirExists) {
        return { recordsDeleted: 0, spaceReclaimed: 0 };
      }

      const files = await fs.readdir(backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - backupRetentionDays);

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          if (!dryRun) {
            await fs.unlink(filePath);
          }
          filesDeleted++;
          spaceReclaimed += stats.size;
        }
      }
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }

    return {
      recordsDeleted: filesDeleted,
      spaceReclaimed,
    };
  }

  private async cleanupAuditLogs(dryRun: boolean): Promise<CleanupTaskResult> {
    const auditLogRetentionDays = 365; // Keep audit logs for 1 year
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - auditLogRetentionDays);

    const oldLogs = await prisma.auditLog.count({
      where: { createdAt: { lt: cutoffDate } },
    });

    if (!dryRun && oldLogs > 0) {
      // In production, archive to S3 before deleting
      // For now, just delete
      await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });
    }

    return {
      recordsDeleted: oldLogs,
      spaceReclaimed: oldLogs * 1024, // Estimate 1KB per log entry
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Data cleanup job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Data cleanup job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Data cleanup worker error:', err);
    });
  }

  async shutdown() {
    await this.worker.close();
  }
}

// Create and export processor instance
export const dataCleanupProcessor = new DataCleanupProcessor();