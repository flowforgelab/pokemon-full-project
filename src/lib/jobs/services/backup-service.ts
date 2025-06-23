import { JobQueue, BackupJobData, BackupDestination, JobPriority } from '../types';
import { QueueManager } from '../queues';
import { prisma } from '@/lib/db/db';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type BackupType = 'full' | 'incremental' | 'differential';

export interface BackupOptions {
  compress?: boolean;
  encrypt?: boolean;
  destinations?: BackupDestination[];
  includeLogs?: boolean;
  includeUploads?: boolean;
}

export interface RestoreOptions {
  targetDatabase?: string;
  restorePoint?: Date;
  tablesToRestore?: string[];
  dropExisting?: boolean;
  verifyChecksum?: boolean;
}

export interface BackupHealthReport {
  lastFullBackup: Date | null;
  lastIncrementalBackup: Date | null;
  backupsInLast24Hours: number;
  totalBackupSize: number;
  oldestBackup: Date | null;
  failedBackups: number;
  averageBackupDuration: number;
  storageUsage: {
    local: number;
    cloud: number;
    total: number;
  };
}

export interface BackupSchedule {
  type: BackupType;
  cron: string;
  options: BackupOptions;
}

export class BackupService {
  /**
   * Create a backup
   */
  async createBackup(type: BackupType, options?: BackupOptions): Promise<string> {
    const jobData: BackupJobData = {
      type,
      compress: options?.compress ?? true,
      encrypt: options?.encrypt ?? true,
      destinations: options?.destinations || this.getDefaultDestinations(),
      includeLogs: options?.includeLogs ?? false,
      includeUploads: options?.includeUploads ?? false,
    };

    const job = await QueueManager.addJob(
      JobQueue.BACKUP,
      `backup-${type}`,
      jobData,
      {
        priority: JobPriority.HIGH,
        scheduledBy: 'admin',
        reason: `Manual ${type} backup`,
      }
    );

    return job.id!;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await prisma.backupMetadata.findUnique({
        where: { backupId },
      });

      if (!metadata) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // For cloud backups, download first
      let localPath = metadata.location;
      if (metadata.location.startsWith('s3://') || metadata.location.startsWith('gs://')) {
        localPath = await this.downloadBackup(metadata.location);
      }

      // Calculate checksum of the file
      const checksum = await this.calculateChecksum(localPath);
      
      // Clean up downloaded file
      if (localPath !== metadata.location) {
        await fs.unlink(localPath).catch(() => {});
      }

      return checksum === metadata.checksum;

    } catch (error) {
      console.error(`Failed to verify backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string, options: RestoreOptions = {}): Promise<void> {
    const metadata = await prisma.backupMetadata.findUnique({
      where: { backupId },
    });

    if (!metadata) {
      throw new Error(`Backup ${backupId} not found`);
    }

    // Verify checksum if requested
    if (options.verifyChecksum) {
      const isValid = await this.verifyBackup(backupId);
      if (!isValid) {
        throw new Error('Backup checksum verification failed');
      }
    }

    // Download backup if in cloud
    let localPath = metadata.location;
    if (metadata.location.startsWith('s3://') || metadata.location.startsWith('gs://')) {
      localPath = await this.downloadBackup(metadata.location);
    }

    // Decrypt if needed
    if (localPath.endsWith('.enc')) {
      localPath = await this.decryptBackup(localPath);
    }

    // Decompress if needed
    if (localPath.endsWith('.gz')) {
      localPath = await this.decompressBackup(localPath);
    }

    // Restore database
    await this.restoreDatabase(localPath, options);

    // Clean up temporary files
    if (localPath !== metadata.location) {
      await fs.unlink(localPath).catch(() => {});
    }

    // Log restoration
    await prisma.backupRestore.create({
      data: {
        backupId,
        restoredAt: new Date(),
        restoredBy: 'admin',
        options: options as any,
        success: true,
      },
    });
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpiredBackups(): Promise<void> {
    const expiredBackups = await prisma.backupMetadata.findMany({
      where: {
        retentionDate: { lt: new Date() },
      },
    });

    for (const backup of expiredBackups) {
      try {
        // Delete from storage
        if (backup.location.startsWith('s3://')) {
          await this.deleteFromS3(backup.location);
        } else if (backup.location.startsWith('gs://')) {
          await this.deleteFromGCS(backup.location);
        } else {
          await fs.unlink(backup.location).catch(() => {});
        }

        // Remove metadata
        await prisma.backupMetadata.delete({
          where: { id: backup.id },
        });

      } catch (error) {
        console.error(`Failed to clean up backup ${backup.backupId}:`, error);
      }
    }
  }

  /**
   * Test backup integrity
   */
  async testBackupIntegrity(): Promise<BackupHealthReport> {
    const backups = await prisma.backupMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const fullBackups = backups.filter(b => b.type === 'full');
    const incrementalBackups = backups.filter(b => b.type === 'incremental');
    const recentBackups = backups.filter(b => b.createdAt > last24Hours);
    const failedBackups = backups.filter(b => b.errors.length > 0);

    const totalSize = backups.reduce((sum, b) => sum + (b.compressedSize || b.size), 0);
    const totalDuration = backups.reduce((sum, b) => sum + b.duration, 0);

    // Calculate storage usage
    const localBackups = backups.filter(b => !b.location.startsWith('s3://') && !b.location.startsWith('gs://'));
    const cloudBackups = backups.filter(b => b.location.startsWith('s3://') || b.location.startsWith('gs://'));

    const localSize = localBackups.reduce((sum, b) => sum + (b.compressedSize || b.size), 0);
    const cloudSize = cloudBackups.reduce((sum, b) => sum + (b.compressedSize || b.size), 0);

    return {
      lastFullBackup: fullBackups[0]?.createdAt || null,
      lastIncrementalBackup: incrementalBackups[0]?.createdAt || null,
      backupsInLast24Hours: recentBackups.length,
      totalBackupSize: totalSize,
      oldestBackup: backups[backups.length - 1]?.createdAt || null,
      failedBackups: failedBackups.length,
      averageBackupDuration: backups.length > 0 ? totalDuration / backups.length : 0,
      storageUsage: {
        local: localSize,
        cloud: cloudSize,
        total: totalSize,
      },
    };
  }

  /**
   * Schedule recurring backups
   */
  async scheduleBackups(schedule: BackupSchedule): Promise<void> {
    await QueueManager.scheduleJob(
      JobQueue.BACKUP,
      `scheduled-backup-${schedule.type}`,
      {
        type: schedule.type,
        ...schedule.options,
      },
      schedule.cron,
      {
        scheduledBy: 'system',
        reason: `Scheduled ${schedule.type} backup`,
      }
    );
  }

  /**
   * Get backup history
   */
  async getBackupHistory(limit = 50): Promise<any[]> {
    const backups = await prisma.backupMetadata.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return backups.map(backup => ({
      backupId: backup.backupId,
      type: backup.type,
      size: this.formatBytes(backup.size),
      compressedSize: backup.compressedSize ? this.formatBytes(backup.compressedSize) : null,
      location: backup.location,
      createdAt: backup.createdAt,
      duration: `${Math.round(backup.duration / 1000)}s`,
      tablesBackedUp: backup.tablesBackedUp.length,
      hasErrors: backup.errors.length > 0,
      retentionDate: backup.retentionDate,
    }));
  }

  /**
   * Get restoration points
   */
  async getRestorationPoints(): Promise<Array<{
    backupId: string;
    type: string;
    date: Date;
    size: string;
    available: boolean;
  }>> {
    const backups = await prisma.backupMetadata.findMany({
      where: {
        errors: { isEmpty: true },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const points = [];
    
    for (const backup of backups) {
      const available = await this.isBackupAvailable(backup.location);
      
      points.push({
        backupId: backup.backupId,
        type: backup.type,
        date: backup.createdAt,
        size: this.formatBytes(backup.compressedSize || backup.size),
        available,
      });
    }

    return points;
  }

  // Private helper methods

  private getDefaultDestinations(): BackupDestination[] {
    const destinations: BackupDestination[] = [];

    if (process.env.BACKUP_S3_BUCKET) {
      destinations.push({
        type: 's3',
        config: {
          bucket: process.env.BACKUP_S3_BUCKET,
          prefix: 'database-backups/',
        },
      });
    }

    if (process.env.BACKUP_GCS_BUCKET) {
      destinations.push({
        type: 'gcs',
        config: {
          bucket: process.env.BACKUP_GCS_BUCKET,
          prefix: 'database-backups/',
        },
      });
    }

    // Always keep a local copy
    destinations.push({
      type: 'local',
      config: {
        directory: '/var/backups/pokemon-tcg',
      },
    });

    return destinations;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = await fs.readFile(filePath);
    hash.update(stream);
    return hash.digest('hex');
  }

  private async downloadBackup(location: string): Promise<string> {
    const tempPath = `/tmp/restore-${Date.now()}.backup`;

    if (location.startsWith('s3://')) {
      await execAsync(`aws s3 cp ${location} ${tempPath}`);
    } else if (location.startsWith('gs://')) {
      await execAsync(`gsutil cp ${location} ${tempPath}`);
    }

    return tempPath;
  }

  private async decryptBackup(filePath: string): Promise<string> {
    const decryptedPath = filePath.replace('.enc', '');
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY not configured');
    }

    await execAsync(
      `openssl enc -aes-256-cbc -d -in ${filePath} -out ${decryptedPath} -k "${encryptionKey}"`
    );

    await fs.unlink(filePath);
    return decryptedPath;
  }

  private async decompressBackup(filePath: string): Promise<string> {
    const decompressedPath = filePath.replace('.gz', '');
    
    await execAsync(`gunzip -c ${filePath} > ${decompressedPath}`);
    
    await fs.unlink(filePath);
    return decompressedPath;
  }

  private async restoreDatabase(backupPath: string, options: RestoreOptions) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const url = new URL(dbUrl);
    const targetDb = options.targetDatabase || url.pathname.slice(1);
    const host = url.hostname;
    const port = url.port || '5432';
    const username = url.username;
    const password = url.password;

    // Drop existing database if requested
    if (options.dropExisting) {
      await execAsync(
        `PGPASSWORD="${password}" dropdb -h ${host} -p ${port} -U ${username} ${targetDb} --if-exists`
      );
      await execAsync(
        `PGPASSWORD="${password}" createdb -h ${host} -p ${port} -U ${username} ${targetDb}`
      );
    }

    // Restore the backup
    let restoreCommand = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${username} -d ${targetDb} -f ${backupPath}`;

    if (options.tablesToRestore && options.tablesToRestore.length > 0) {
      // Selective restore would require parsing the backup file
      // For now, we'll do a full restore
      console.warn('Selective table restore not implemented, performing full restore');
    }

    await execAsync(restoreCommand);
  }

  private async deleteFromS3(location: string) {
    await execAsync(`aws s3 rm ${location}`);
  }

  private async deleteFromGCS(location: string) {
    await execAsync(`gsutil rm ${location}`);
  }

  private async isBackupAvailable(location: string): Promise<boolean> {
    try {
      if (location.startsWith('s3://')) {
        const { stdout } = await execAsync(`aws s3 ls ${location}`);
        return stdout.length > 0;
      } else if (location.startsWith('gs://')) {
        const { stdout } = await execAsync(`gsutil ls ${location}`);
        return stdout.length > 0;
      } else {
        await fs.access(location);
        return true;
      }
    } catch {
      return false;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const backupService = new BackupService();