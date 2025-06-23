import { JobQueue, JobPriority } from '../types';
import { QueueManager, queues } from '../queues';
import { prisma } from '@/server/db/prisma';
import { redisCache } from '@/server/db/redis';
import { jobScheduler } from '../scheduler';
import { priceUpdateService } from './price-update-service';
import { setImportService } from './set-import-service';
import { dataMaintenanceService } from './data-maintenance-service';
import { backupService } from './backup-service';

export interface AdminAction {
  id: string;
  adminUserId: string;
  action: string;
  parameters: Record<string, any>;
  timestamp: Date;
  reason: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  auditLog: string[];
}

export interface MaintenanceMode {
  enabled: boolean;
  startedAt?: Date;
  duration?: number;
  reason?: string;
  allowedOperations?: string[];
}

export class AdminService {
  private maintenanceMode: MaintenanceMode = { enabled: false };

  /**
   * Trigger a manual job
   */
  async triggerManualJob(
    jobType: string,
    params: any,
    reason: string,
    adminUserId: string
  ): Promise<string> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} triggered manual job: ${jobType}`);
      auditLog.push(`Reason: ${reason}`);
      auditLog.push(`Parameters: ${JSON.stringify(params)}`);

      let jobId: string | undefined;

      switch (jobType) {
        case 'price-update':
          jobId = await priceUpdateService.schedulePriceUpdate({
            type: params.type || 'incremental',
            cardIds: params.cardIds,
            force: true,
            priority: JobPriority.HIGH,
          });
          break;

        case 'set-import':
          jobId = await setImportService.importSet(params.setCode, {
            includeImages: params.includeImages ?? true,
            initializePrices: params.initializePrices ?? true,
            notifyUsers: params.notifyUsers ?? false,
          });
          break;

        case 'data-validation':
          jobId = await dataMaintenanceService.runValidation({
            rules: params.rules,
            autoFix: params.autoFix ?? false,
            scope: params.scope || 'all',
            dryRun: params.dryRun ?? true,
          });
          break;

        case 'data-cleanup':
          jobId = await dataMaintenanceService.runCleanup({
            tasks: params.tasks,
            dryRun: params.dryRun ?? true,
            force: params.force ?? false,
          });
          break;

        case 'backup':
          jobId = await backupService.createBackup(
            params.type || 'full',
            {
              compress: params.compress ?? true,
              encrypt: params.encrypt ?? true,
              includeLogs: params.includeLogs ?? true,
            }
          );
          break;

        default:
          // Generic job trigger
          const job = await QueueManager.addJob(
            params.queue || JobQueue.MAINTENANCE,
            jobType,
            params.data || {},
            {
              priority: JobPriority.HIGH,
              scheduledBy: 'admin',
              reason,
              manual: true,
              adminUserId,
            }
          );
          jobId = job.id;
      }

      auditLog.push(`Job created with ID: ${jobId}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'trigger-manual-job',
        parameters: { jobType, params, jobId },
        timestamp: new Date(),
        reason,
        status: 'completed',
        result: { jobId },
        auditLog,
      });

      return jobId || actionId;

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'trigger-manual-job',
        parameters: { jobType, params },
        timestamp: new Date(),
        reason,
        status: 'failed',
        result: { error: error instanceof Error ? error.message : 'Unknown error' },
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Override validation results
   */
  async overrideValidation(
    validationId: string,
    reason: string,
    adminUserId: string
  ): Promise<void> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} overriding validation ${validationId}`);
      auditLog.push(`Reason: ${reason}`);

      // Mark validation as overridden
      await redisCache.set(
        `validation:override:${validationId}`,
        JSON.stringify({
          overriddenBy: adminUserId,
          reason,
          timestamp: new Date(),
        }),
        86400 // 24 hours
      );

      auditLog.push('Validation override applied');

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'override-validation',
        parameters: { validationId },
        timestamp: new Date(),
        reason,
        status: 'completed',
        auditLog,
      });

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'override-validation',
        parameters: { validationId },
        timestamp: new Date(),
        reason,
        status: 'failed',
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Emergency rollback
   */
  async emergencyRollback(
    componentId: string,
    targetDate: Date,
    adminUserId: string
  ): Promise<void> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} initiating emergency rollback`);
      auditLog.push(`Component: ${componentId}`);
      auditLog.push(`Target date: ${targetDate.toISOString()}`);

      switch (componentId) {
        case 'prices':
          // Get all price updates since target date
          const priceUpdates = await prisma.priceHistory.findMany({
            where: { date: { gte: targetDate } },
            select: { cardId: true },
            distinct: ['cardId'],
          });

          for (const update of priceUpdates) {
            // Get price before target date
            const previousPrice = await prisma.priceHistory.findFirst({
              where: {
                cardId: update.cardId,
                date: { lt: targetDate },
              },
              orderBy: { date: 'desc' },
            });

            if (previousPrice) {
              await prisma.cardPrice.updateMany({
                where: { cardId: update.cardId },
                data: {
                  marketPrice: previousPrice.marketPrice,
                  lowPrice: previousPrice.lowPrice,
                  midPrice: previousPrice.midPrice,
                  highPrice: previousPrice.highPrice,
                },
              });
            }
          }

          auditLog.push(`Rolled back ${priceUpdates.length} price updates`);
          break;

        case 'database':
          // Restore from backup
          const backups = await prisma.backupMetadata.findMany({
            where: {
              createdAt: { lt: targetDate },
              errors: { isEmpty: true },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });

          if (backups.length > 0) {
            await backupService.restoreFromBackup(backups[0].backupId, {
              verifyChecksum: true,
            });
            auditLog.push(`Restored from backup ${backups[0].backupId}`);
          } else {
            throw new Error('No suitable backup found for rollback');
          }
          break;

        default:
          throw new Error(`Unknown component: ${componentId}`);
      }

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'emergency-rollback',
        parameters: { componentId, targetDate },
        timestamp: new Date(),
        reason: 'Emergency rollback initiated',
        status: 'completed',
        auditLog,
      });

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'emergency-rollback',
        parameters: { componentId, targetDate },
        timestamp: new Date(),
        reason: 'Emergency rollback initiated',
        status: 'failed',
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Enable maintenance mode
   */
  async enableMaintenanceMode(
    duration: number,
    reason: string,
    adminUserId: string,
    allowedOperations?: string[]
  ): Promise<void> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} enabling maintenance mode`);
      auditLog.push(`Duration: ${duration} minutes`);
      auditLog.push(`Reason: ${reason}`);

      this.maintenanceMode = {
        enabled: true,
        startedAt: new Date(),
        duration,
        reason,
        allowedOperations: allowedOperations || [],
      };

      // Store in Redis for distributed systems
      await redisCache.set(
        'system:maintenance-mode',
        JSON.stringify(this.maintenanceMode),
        duration * 60
      );

      // Pause non-critical queues
      const queuesToPause = [
        JobQueue.PRICE_UPDATE,
        JobQueue.SET_IMPORT,
        JobQueue.DATA_VALIDATION,
        JobQueue.DATA_CLEANUP,
      ];

      for (const queueName of queuesToPause) {
        await QueueManager.pauseQueue(queueName);
        auditLog.push(`Paused queue: ${queueName}`);
      }

      // Schedule automatic disable
      setTimeout(async () => {
        await this.disableMaintenanceMode(adminUserId);
      }, duration * 60 * 1000);

      auditLog.push('Maintenance mode enabled');

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'enable-maintenance-mode',
        parameters: { duration, reason, allowedOperations },
        timestamp: new Date(),
        reason,
        status: 'completed',
        auditLog,
      });

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'enable-maintenance-mode',
        parameters: { duration, reason, allowedOperations },
        timestamp: new Date(),
        reason,
        status: 'failed',
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Disable maintenance mode
   */
  async disableMaintenanceMode(adminUserId: string): Promise<void> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} disabling maintenance mode`);

      this.maintenanceMode = { enabled: false };

      // Remove from Redis
      await redisCache.delete('system:maintenance-mode');

      // Resume queues
      const queuesToResume = [
        JobQueue.PRICE_UPDATE,
        JobQueue.SET_IMPORT,
        JobQueue.DATA_VALIDATION,
        JobQueue.DATA_CLEANUP,
      ];

      for (const queueName of queuesToResume) {
        await QueueManager.resumeQueue(queueName);
        auditLog.push(`Resumed queue: ${queueName}`);
      }

      auditLog.push('Maintenance mode disabled');

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'disable-maintenance-mode',
        parameters: {},
        timestamp: new Date(),
        reason: 'Maintenance completed',
        status: 'completed',
        auditLog,
      });

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'disable-maintenance-mode',
        parameters: {},
        timestamp: new Date(),
        reason: 'Maintenance completed',
        status: 'failed',
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Get maintenance mode status
   */
  async getMaintenanceMode(): Promise<MaintenanceMode> {
    // Check Redis for distributed status
    const redisMode = await redisCache.get('system:maintenance-mode');
    
    if (redisMode) {
      this.maintenanceMode = JSON.parse(redisMode);
    }

    return this.maintenanceMode;
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(adminUserId: string, patterns?: string[]): Promise<void> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} clearing caches`);
      auditLog.push(`Patterns: ${patterns?.join(', ') || 'all'}`);

      const patternsToClean = patterns || [
        'card:*',
        'search:*',
        'price:*',
        'collection:*',
        'analysis:*',
        'format:*',
        'set:*',
      ];

      let totalDeleted = 0;

      for (const pattern of patternsToClean) {
        const deleted = await redisCache.deletePattern(pattern);
        totalDeleted += deleted;
        auditLog.push(`Cleared ${deleted} keys matching ${pattern}`);
      }

      auditLog.push(`Total cache entries cleared: ${totalDeleted}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'clear-caches',
        parameters: { patterns: patternsToClean },
        timestamp: new Date(),
        reason: 'Manual cache clear',
        status: 'completed',
        result: { totalDeleted },
        auditLog,
      });

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'clear-caches',
        parameters: { patterns },
        timestamp: new Date(),
        reason: 'Manual cache clear',
        status: 'failed',
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Adjust rate limits
   */
  async adjustRateLimit(
    service: string,
    newLimit: number,
    duration: number,
    adminUserId: string
  ): Promise<void> {
    const actionId = `admin-action-${Date.now()}`;
    const auditLog: string[] = [];

    try {
      auditLog.push(`Admin ${adminUserId} adjusting rate limit`);
      auditLog.push(`Service: ${service}`);
      auditLog.push(`New limit: ${newLimit} requests per ${duration} seconds`);

      // Store rate limit override
      await redisCache.set(
        `ratelimit:override:${service}`,
        JSON.stringify({
          limit: newLimit,
          duration,
          setBy: adminUserId,
          setAt: new Date(),
        }),
        3600 // 1 hour
      );

      auditLog.push('Rate limit adjusted');

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'adjust-rate-limit',
        parameters: { service, newLimit, duration },
        timestamp: new Date(),
        reason: 'Manual rate limit adjustment',
        status: 'completed',
        auditLog,
      });

    } catch (error) {
      auditLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      await this.logAdminAction({
        id: actionId,
        adminUserId,
        action: 'adjust-rate-limit',
        parameters: { service, newLimit, duration },
        timestamp: new Date(),
        reason: 'Manual rate limit adjustment',
        status: 'failed',
        auditLog,
      });

      throw error;
    }
  }

  /**
   * Get admin action history
   */
  async getActionHistory(
    filters?: {
      adminUserId?: string;
      action?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<AdminAction[]> {
    const where: any = {};

    if (filters?.adminUserId) where.adminUserId = filters.adminUserId;
    if (filters?.action) where.action = filters.action;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const actions = await prisma.adminAction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return actions.map(a => ({
      id: a.id,
      adminUserId: a.adminUserId,
      action: a.action,
      parameters: a.parameters as Record<string, any>,
      timestamp: a.timestamp,
      reason: a.reason,
      status: a.status as 'pending' | 'completed' | 'failed',
      result: a.result,
      auditLog: a.auditLog,
    }));
  }

  /**
   * Log admin action
   */
  async logAdminAction(action: AdminAction): Promise<void> {
    await prisma.adminAction.create({
      data: {
        id: action.id,
        adminUserId: action.adminUserId,
        action: action.action,
        parameters: action.parameters,
        timestamp: action.timestamp,
        reason: action.reason,
        status: action.status,
        result: action.result || {},
        auditLog: action.auditLog,
      },
    });

    // Also create audit log entry
    await prisma.auditLog.create({
      data: {
        category: 'admin',
        action: action.action,
        actorId: action.adminUserId,
        actorType: 'user',
        metadata: {
          actionId: action.id,
          parameters: action.parameters,
          result: action.result,
        },
      },
    });
  }
}

// Export singleton instance
export const adminService = new AdminService();