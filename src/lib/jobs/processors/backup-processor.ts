import { Worker, Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  BackupJobData,
  BackupResult,
  BackupDestination,
  JobQueue
} from '../types';

const execAsync = promisify(exec);

export class BackupProcessor {
  private worker: Worker;
  private backupDir: string;

  constructor() {
    this.backupDir = process.env.BACKUP_DIR || '/tmp/backups';
    
    this.worker = new Worker(
      JobQueue.BACKUP,
      this.process.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 1, // Only one backup at a time
      }
    );

    this.setupEventHandlers();
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error);
    }
  }

  private async process(job: Job<BackupJobData>): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const errors: string[] = [];
    
    try {
      await job.log(`Starting ${job.data.type} backup: ${backupId}`);
      
      // Create backup based on type
      const backupFile = await this.createBackup(job.data, backupId, job);
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(backupFile.path);
      
      // Compress if requested
      let finalPath = backupFile.path;
      let compressedSize = backupFile.size;
      
      if (job.data.compress) {
        const compressed = await this.compressBackup(backupFile.path);
        finalPath = compressed.path;
        compressedSize = compressed.size;
      }
      
      await job.updateProgress(70);
      
      // Encrypt if requested
      if (job.data.encrypt) {
        const encrypted = await this.encryptBackup(finalPath);
        finalPath = encrypted.path;
        compressedSize = encrypted.size;
      }
      
      await job.updateProgress(80);
      
      // Upload to destinations
      const uploadedLocations = await this.uploadBackup(
        finalPath,
        job.data.destinations || [],
        job
      );
      
      await job.updateProgress(95);
      
      // Clean up local file if uploaded successfully
      if (uploadedLocations.length > 0) {
        await fs.unlink(finalPath).catch(err => {
          console.error('Failed to clean up local backup:', err);
        });
      }
      
      const result: BackupResult = {
        backupId,
        type: job.data.type,
        size: backupFile.size,
        compressedSize: job.data.compress ? compressedSize : undefined,
        location: uploadedLocations.length > 0 ? uploadedLocations[0] : finalPath,
        checksum,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        tablesBackedUp: backupFile.tables,
        errors,
      };
      
      await job.log(`Backup completed: ${backupId}`);
      await job.updateProgress(100);
      
      // Store backup metadata
      await this.storeBackupMetadata(result);
      
      return result;
      
    } catch (error) {
      await job.log(`Fatal error in backup: ${error}`);
      throw error;
    }
  }

  private async createBackup(
    data: BackupJobData,
    backupId: string,
    job: Job
  ): Promise<{ path: string; size: number; tables: string[] }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${data.type}-backup-${timestamp}.sql`;
    const backupPath = path.join(this.backupDir, filename);
    
    let tables: string[] = [];
    
    try {
      // Get database connection details from DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not configured');
      }
      
      // Parse connection string
      const url = new URL(dbUrl);
      const dbName = url.pathname.slice(1);
      const host = url.hostname;
      const port = url.port || '5432';
      const username = url.username;
      const password = url.password;
      
      await job.log('Creating database backup...');
      
      // Get list of tables
      const tableResult = await prisma.$queryRaw<any[]>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `;
      tables = tableResult.map(t => t.tablename);
      
      let pgDumpCommand: string;
      
      switch (data.type) {
        case 'full':
          // Full backup of entire database
          pgDumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} -f ${backupPath}`;
          break;
          
        case 'incremental':
          // Incremental backup (tables modified in last 24 hours)
          const modifiedTables = await this.getModifiedTables(24);
          if (modifiedTables.length === 0) {
            throw new Error('No tables modified in the last 24 hours');
          }
          const tableArgs = modifiedTables.map(t => `-t ${t}`).join(' ');
          pgDumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} ${tableArgs} -f ${backupPath}`;
          tables = modifiedTables;
          break;
          
        case 'differential':
          // Differential backup (all changes since last full backup)
          const lastFullBackup = await this.getLastFullBackupDate();
          const diffTables = await this.getModifiedTablesSince(lastFullBackup);
          if (diffTables.length === 0) {
            throw new Error('No tables modified since last full backup');
          }
          const diffTableArgs = diffTables.map(t => `-t ${t}`).join(' ');
          pgDumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} ${diffTableArgs} -f ${backupPath}`;
          tables = diffTables;
          break;
          
        default:
          throw new Error(`Unknown backup type: ${data.type}`);
      }
      
      // Execute pg_dump
      await job.log(`Executing backup for ${tables.length} tables...`);
      const { stdout, stderr } = await execAsync(pgDumpCommand);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`pg_dump error: ${stderr}`);
      }
      
      // Include additional data if requested
      if (data.includeLogs) {
        await this.appendLogsToBackup(backupPath);
      }
      
      if (data.includeUploads) {
        await this.createUploadsBackup(backupId);
      }
      
      // Get file size
      const stats = await fs.stat(backupPath);
      
      return {
        path: backupPath,
        size: stats.size,
        tables,
      };
      
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  private async getModifiedTables(hours: number): Promise<string[]> {
    // This is a simplified approach - in production, you'd track table modifications
    // For now, return tables likely to change frequently
    return ['cards', 'card_prices', 'decks', 'user_collections', 'audit_logs'];
  }

  private async getModifiedTablesSince(date: Date): Promise<string[]> {
    // Similar to above, but checking since a specific date
    return ['cards', 'card_prices', 'decks', 'user_collections', 'notifications', 'audit_logs'];
  }

  private async getLastFullBackupDate(): Promise<Date> {
    // Get the date of the last full backup from metadata
    const lastBackup = await prisma.backupMetadata.findFirst({
      where: { type: 'full' },
      orderBy: { createdAt: 'desc' },
    });
    
    return lastBackup?.createdAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
  }

  private async appendLogsToBackup(backupPath: string): Promise<void> {
    // Append recent logs to the backup
    const logsQuery = `
      -- Recent Audit Logs
      COPY (
        SELECT * FROM audit_logs 
        WHERE created_at > NOW() - INTERVAL '7 days'
      ) TO STDOUT WITH CSV HEADER;
    `;
    
    await fs.appendFile(backupPath, `\n\n${logsQuery}\n`);
  }

  private async createUploadsBackup(backupId: string): Promise<void> {
    const uploadsDir = process.env.UPLOADS_DIR || '/uploads';
    const uploadsBackupPath = path.join(this.backupDir, `uploads-${backupId}.tar`);
    
    try {
      await execAsync(`tar -cf ${uploadsBackupPath} -C ${uploadsDir} .`);
    } catch (error) {
      console.error('Failed to backup uploads:', error);
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = await fs.readFile(filePath);
    hash.update(stream);
    return hash.digest('hex');
  }

  private async compressBackup(filePath: string): Promise<{ path: string; size: number }> {
    const compressedPath = `${filePath}.gz`;
    
    await execAsync(`gzip -c ${filePath} > ${compressedPath}`);
    
    const stats = await fs.stat(compressedPath);
    
    // Remove original file
    await fs.unlink(filePath);
    
    return {
      path: compressedPath,
      size: stats.size,
    };
  }

  private async encryptBackup(filePath: string): Promise<{ path: string; size: number }> {
    const encryptedPath = `${filePath}.enc`;
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY not configured');
    }
    
    // Use OpenSSL for encryption
    await execAsync(
      `openssl enc -aes-256-cbc -salt -in ${filePath} -out ${encryptedPath} -k "${encryptionKey}"`
    );
    
    const stats = await fs.stat(encryptedPath);
    
    // Remove unencrypted file
    await fs.unlink(filePath);
    
    return {
      path: encryptedPath,
      size: stats.size,
    };
  }

  private async uploadBackup(
    filePath: string,
    destinations: BackupDestination[],
    job: Job
  ): Promise<string[]> {
    const uploadedLocations: string[] = [];
    
    for (const dest of destinations) {
      try {
        await job.log(`Uploading to ${dest.type}...`);
        
        switch (dest.type) {
          case 's3':
            const s3Location = await this.uploadToS3(filePath, dest.config);
            uploadedLocations.push(s3Location);
            break;
            
          case 'gcs':
            const gcsLocation = await this.uploadToGCS(filePath, dest.config);
            uploadedLocations.push(gcsLocation);
            break;
            
          case 'azure':
            const azureLocation = await this.uploadToAzure(filePath, dest.config);
            uploadedLocations.push(azureLocation);
            break;
            
          case 'local':
            const localLocation = await this.copyToLocal(filePath, dest.config);
            uploadedLocations.push(localLocation);
            break;
            
          default:
            console.error(`Unknown destination type: ${dest.type}`);
        }
      } catch (error) {
        console.error(`Failed to upload to ${dest.type}:`, error);
      }
    }
    
    return uploadedLocations;
  }

  private async uploadToS3(filePath: string, config: any): Promise<string> {
    const { bucket, prefix = '' } = config;
    const fileName = path.basename(filePath);
    const s3Key = path.join(prefix, fileName);
    
    // In production, use AWS SDK
    // For now, use AWS CLI
    await execAsync(
      `aws s3 cp ${filePath} s3://${bucket}/${s3Key}`
    );
    
    return `s3://${bucket}/${s3Key}`;
  }

  private async uploadToGCS(filePath: string, config: any): Promise<string> {
    const { bucket, prefix = '' } = config;
    const fileName = path.basename(filePath);
    const gcsPath = path.join(prefix, fileName);
    
    // In production, use Google Cloud SDK
    // For now, use gsutil
    await execAsync(
      `gsutil cp ${filePath} gs://${bucket}/${gcsPath}`
    );
    
    return `gs://${bucket}/${gcsPath}`;
  }

  private async uploadToAzure(filePath: string, config: any): Promise<string> {
    // Implement Azure Blob Storage upload
    throw new Error('Azure upload not implemented');
  }

  private async copyToLocal(filePath: string, config: any): Promise<string> {
    const { directory } = config;
    const fileName = path.basename(filePath);
    const destPath = path.join(directory, fileName);
    
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(filePath, destPath);
    
    return destPath;
  }

  private async storeBackupMetadata(result: BackupResult) {
    await prisma.backupMetadata.create({
      data: {
        backupId: result.backupId,
        type: result.type,
        size: result.size,
        compressedSize: result.compressedSize,
        location: result.location,
        checksum: result.checksum,
        duration: result.duration,
        tablesBackedUp: result.tablesBackedUp,
        errors: result.errors,
        retentionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days retention
      },
    });
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Backup job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Backup job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Backup worker error:', err);
    });
  }

  async shutdown() {
    await this.worker.close();
  }
}

// Create and export processor instance
export const backupProcessor = new BackupProcessor();