import { Job } from 'bullmq';

export enum JobQueue {
  PRICE_UPDATE = 'price-update',
  SET_IMPORT = 'set-import',
  DATA_VALIDATION = 'data-validation',
  DATA_CLEANUP = 'data-cleanup',
  FORMAT_ROTATION = 'format-rotation',
  BACKUP = 'backup',
  AUDIT = 'audit',
  MAINTENANCE = 'maintenance',
}

export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

export interface JobResult<T = any> {
  success: boolean;
  data?: T;
  errors?: Array<{
    code: string;
    message: string;
    details?: any;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
  metadata?: {
    startedAt: Date;
    completedAt: Date;
    duration: number;
    retryCount?: number;
  };
}

// Price Update Types
export interface PriceUpdateJobData {
  type: 'full' | 'incremental' | 'specific';
  cardIds?: string[];
  force?: boolean;
  validateOnly?: boolean;
}

export interface PriceUpdateResult {
  cardsProcessed: number;
  cardsUpdated: number;
  pricesCreated: number;
  pricesUpdated: number;
  errors: PriceUpdateError[];
  summary: PriceUpdateSummary;
}

export interface PriceUpdateError {
  cardId: string;
  cardName: string;
  error: string;
  timestamp: Date;
}

export interface PriceUpdateSummary {
  cardsUpdated: number;
  averagePriceChange: number;
  significantChanges: Array<{
    cardId: string;
    cardName: string;
    oldPrice: number;
    newPrice: number;
    changePercent: number;
  }>;
  apiCallsUsed: number;
  processingTimeMs: number;
}

// Set Import Types
export interface SetImportJobData {
  setCode: string;
  setId?: string;
  includeImages?: boolean;
  initializePrices?: boolean;
  notifyUsers?: boolean;
}

export interface SetImportResult {
  setCode: string;
  setName: string;
  releaseDate: Date;
  cardsImported: number;
  cardsUpdated: number;
  imagesProcessed: number;
  legalityUpdated: boolean;
  pricesInitialized: boolean;
  notificationsSent: number;
  errors: SetImportError[];
}

export interface SetImportError {
  cardNumber: string;
  error: string;
  details?: any;
}

// Data Validation Types
export interface DataValidationJobData {
  rules?: string[];
  autoFix?: boolean;
  scope?: 'all' | 'cards' | 'decks' | 'collections' | 'users' | 'prices';
  dryRun?: boolean;
}

export interface DataValidationResult {
  rulesExecuted: number;
  issuesFound: number;
  issuesFixed: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  report: ValidationReport;
}

export interface ValidationError {
  rule: string;
  entityType: string;
  entityId: string;
  message: string;
  severity: 'error' | 'critical';
  fixAvailable: boolean;
}

export interface ValidationWarning {
  rule: string;
  entityType: string;
  entityId: string;
  message: string;
  suggestion?: string;
}

export interface ValidationReport {
  timestamp: Date;
  duration: number;
  summary: {
    totalEntitiesChecked: number;
    errorCount: number;
    warningCount: number;
    fixedCount: number;
  };
  byRule: Record<string, {
    checked: number;
    errors: number;
    warnings: number;
    fixed: number;
  }>;
}

// Data Cleanup Types
export interface DataCleanupJobData {
  tasks?: CleanupTask[];
  dryRun?: boolean;
  force?: boolean;
}

export enum CleanupTask {
  SOFT_DELETED_RECORDS = 'soft-deleted-records',
  EXPIRED_SESSIONS = 'expired-sessions',
  TEMPORARY_FILES = 'temporary-files',
  OLD_LOGS = 'old-logs',
  STALE_CACHE = 'stale-cache',
  ORPHANED_RECORDS = 'orphaned-records',
  OLD_BACKUPS = 'old-backups',
  AUDIT_LOGS = 'audit-logs',
}

export interface DataCleanupResult {
  tasksCompleted: number;
  recordsDeleted: number;
  spaceReclaimed: number;
  errors: Array<{
    task: string;
    error: string;
  }>;
  summary: Record<CleanupTask, {
    recordsDeleted: number;
    spaceReclaimed: number;
  }>;
}

// Format Rotation Types
export interface FormatRotationJobData {
  format: 'standard' | 'expanded';
  effectiveDate: Date;
  rotatedSets: string[];
  newLegalSets: string[];
  notifyUsers?: boolean;
  generateMigrations?: boolean;
}

export interface FormatRotationResult {
  format: string;
  effectiveDate: Date;
  affectedDecks: number;
  affectedUsers: number;
  migrationsGenerated: number;
  notificationsSent: number;
  errors: Array<{
    deckId: string;
    error: string;
  }>;
}

// Backup Types
export interface BackupJobData {
  type: 'full' | 'incremental' | 'differential';
  compress?: boolean;
  encrypt?: boolean;
  destinations?: BackupDestination[];
  includeLogs?: boolean;
  includeUploads?: boolean;
}

export interface BackupDestination {
  type: 's3' | 'gcs' | 'azure' | 'local';
  config: Record<string, any>;
}

export interface BackupResult {
  backupId: string;
  type: string;
  size: number;
  compressedSize?: number;
  location: string;
  checksum: string;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  tablesBackedUp: string[];
  errors: string[];
}

// Monitoring Types
export interface SystemHealth {
  timestamp: Date;
  services: Record<string, ServiceHealth>;
  metrics: SystemMetrics;
  alerts: Alert[];
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime: number;
  uptime: number;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    activeQueries: number;
    avgQueryTime: number;
  };
  jobQueue: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
  };
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

// Audit Types
export interface AuditLog {
  id: string;
  timestamp: Date;
  category: 'data' | 'user' | 'system' | 'security' | 'admin';
  action: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'job' | 'api';
  targetId?: string;
  targetType?: string;
  changes?: {
    before: any;
    after: any;
  };
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Schedule Configuration
export interface ScheduleConfig {
  cron: string;
  timezone?: string;
  enabled: boolean;
  retryPolicy?: {
    attempts: number;
    backoff: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  };
  alertOnFailure?: boolean;
  maintenanceWindow?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    days?: number[]; // 0-6 (Sunday-Saturday)
  };
}

// Job Metadata
export interface JobMetadata {
  scheduledBy: 'system' | 'user' | 'admin';
  schedulerId?: string;
  reason?: string;
  manual?: boolean;
  correlationId?: string;
  parentJobId?: string;
  priority: JobPriority;
  retryCount?: number;
  lastError?: string;
  tags?: string[];
}