import { prisma } from '@/server/db/prisma';
import { AuditLog } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'papaparse';

export interface AuditFilters {
  category?: AuditLog['category'] | AuditLog['category'][];
  action?: string | string[];
  actorId?: string;
  actorType?: AuditLog['actorType'];
  targetId?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  hasChanges?: boolean;
}

export interface ComplianceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalActions: number;
    byCategory: Record<string, number>;
    byActorType: Record<string, number>;
    uniqueActors: number;
    dataModifications: number;
    securityEvents: number;
    adminActions: number;
  };
  topActions: Array<{
    action: string;
    count: number;
    category: string;
  }>;
  topActors: Array<{
    actorId: string;
    actorType: string;
    actionCount: number;
  }>;
  dataAccess: {
    exports: number;
    imports: number;
    bulkOperations: number;
  };
  securityEvents: Array<{
    timestamp: Date;
    action: string;
    actorId: string;
    details: any;
  }>;
}

export class AuditService {
  private auditDir: string;

  constructor() {
    this.auditDir = process.env.AUDIT_DIR || '/var/log/pokemon-tcg/audit';
    this.ensureAuditDirectory();
  }

  private async ensureAuditDirectory() {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audit directory:', error);
    }
  }

  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };

    try {
      // Store in database
      await prisma.auditLog.create({
        data: {
          auditId: auditEntry.id,
          category: auditEntry.category,
          action: auditEntry.action,
          actorId: auditEntry.actorId,
          actorType: auditEntry.actorType,
          targetId: auditEntry.targetId,
          targetType: auditEntry.targetType,
          changes: auditEntry.changes,
          metadata: auditEntry.metadata || {},
          ipAddress: auditEntry.ipAddress,
          userAgent: auditEntry.userAgent,
        },
      });

      // Also write to file for backup
      await this.writeToFile(auditEntry);

      // Check for critical events
      await this.checkCriticalEvents(auditEntry);

    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Still try to write to file as backup
      await this.writeToFile(auditEntry).catch(console.error);
    }
  }

  /**
   * Query audit logs
   */
  async query(filters: AuditFilters): Promise<AuditLog[]> {
    const where: any = {};

    if (filters.category) {
      where.category = Array.isArray(filters.category) 
        ? { in: filters.category }
        : filters.category;
    }

    if (filters.action) {
      where.action = Array.isArray(filters.action)
        ? { in: filters.action }
        : filters.action;
    }

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.actorType) where.actorType = filters.actorType;
    if (filters.targetId) where.targetId = filters.targetId;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.hasChanges === true) {
      where.changes = { not: null };
    } else if (filters.hasChanges === false) {
      where.changes = null;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit for performance
    });

    return logs.map(log => ({
      id: log.auditId,
      timestamp: log.createdAt,
      category: log.category as AuditLog['category'],
      action: log.action,
      actorId: log.actorId || undefined,
      actorType: log.actorType as AuditLog['actorType'],
      targetId: log.targetId || undefined,
      targetType: log.targetType || undefined,
      changes: log.changes as AuditLog['changes'],
      metadata: log.metadata as Record<string, any>,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
    }));
  }

  /**
   * Export audit logs
   */
  async exportAuditLog(
    filters: AuditFilters,
    format: 'csv' | 'json'
  ): Promise<string> {
    const logs = await this.query(filters);
    const exportPath = path.join(
      this.auditDir,
      `export-${Date.now()}.${format}`
    );

    if (format === 'json') {
      await fs.writeFile(exportPath, JSON.stringify(logs, null, 2));
    } else {
      // CSV export
      const csvData = logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        category: log.category,
        action: log.action,
        actorId: log.actorId || '',
        actorType: log.actorType,
        targetId: log.targetId || '',
        targetType: log.targetType || '',
        ipAddress: log.ipAddress || '',
        hasChanges: !!log.changes,
        metadata: JSON.stringify(log.metadata),
      }));

      const csv = parse(csvData, {
        header: true,
      });

      await fs.writeFile(exportPath, csv);
    }

    // Log the export action
    await this.log({
      category: 'system',
      action: 'audit-export',
      actorType: 'system',
      metadata: {
        format,
        filters,
        recordCount: logs.length,
        exportPath,
      },
    });

    return exportPath;
  }

  /**
   * Archive old audit logs
   */
  async archiveOldLogs(olderThan: Date): Promise<void> {
    const archivePath = path.join(
      this.auditDir,
      'archive',
      `audit-archive-${olderThan.toISOString().split('T')[0]}.json`
    );

    // Ensure archive directory exists
    await fs.mkdir(path.dirname(archivePath), { recursive: true });

    // Get logs to archive
    const logsToArchive = await prisma.auditLog.findMany({
      where: { createdAt: { lt: olderThan } },
      orderBy: { createdAt: 'asc' },
    });

    if (logsToArchive.length === 0) {
      return;
    }

    // Write to archive file
    await fs.writeFile(
      archivePath,
      JSON.stringify(logsToArchive, null, 2)
    );

    // Compress archive
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(`gzip ${archivePath}`);

    // Delete archived logs from database
    await prisma.auditLog.deleteMany({
      where: {
        auditId: { in: logsToArchive.map(log => log.auditId) },
      },
    });

    // Log the archival
    await this.log({
      category: 'system',
      action: 'audit-archive',
      actorType: 'system',
      metadata: {
        logsArchived: logsToArchive.length,
        archivePath: `${archivePath}.gz`,
        cutoffDate: olderThan,
      },
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(period: {
    start: Date;
    end: Date;
  }): Promise<ComplianceReport> {
    // Get all logs for the period
    const logs = await this.query({
      startDate: period.start,
      endDate: period.end,
    });

    // Calculate summary statistics
    const summary = {
      totalActions: logs.length,
      byCategory: {} as Record<string, number>,
      byActorType: {} as Record<string, number>,
      uniqueActors: new Set<string>(),
      dataModifications: 0,
      securityEvents: 0,
      adminActions: 0,
    };

    const actionCounts: Record<string, { count: number; category: string }> = {};
    const actorCounts: Record<string, { count: number; type: string }> = {};
    const securityEvents: any[] = [];

    for (const log of logs) {
      // Category counts
      summary.byCategory[log.category] = (summary.byCategory[log.category] || 0) + 1;

      // Actor type counts
      summary.byActorType[log.actorType] = (summary.byActorType[log.actorType] || 0) + 1;

      // Unique actors
      if (log.actorId) {
        summary.uniqueActors.add(log.actorId);
      }

      // Data modifications
      if (log.changes) {
        summary.dataModifications++;
      }

      // Security events
      if (log.category === 'security') {
        summary.securityEvents++;
        securityEvents.push({
          timestamp: log.timestamp,
          action: log.action,
          actorId: log.actorId || 'unknown',
          details: log.metadata,
        });
      }

      // Admin actions
      if (log.category === 'admin') {
        summary.adminActions++;
      }

      // Action counts
      if (!actionCounts[log.action]) {
        actionCounts[log.action] = { count: 0, category: log.category };
      }
      actionCounts[log.action].count++;

      // Actor counts
      if (log.actorId) {
        const key = `${log.actorId}:${log.actorType}`;
        if (!actorCounts[key]) {
          actorCounts[key] = { count: 0, type: log.actorType };
        }
        actorCounts[key].count++;
      }
    }

    // Get top actions
    const topActions = Object.entries(actionCounts)
      .map(([action, data]) => ({
        action,
        count: data.count,
        category: data.category,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top actors
    const topActors = Object.entries(actorCounts)
      .map(([key, data]) => {
        const [actorId] = key.split(':');
        return {
          actorId,
          actorType: data.type,
          actionCount: data.count,
        };
      })
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    // Calculate data access metrics
    const dataAccess = {
      exports: logs.filter(l => l.action.includes('export')).length,
      imports: logs.filter(l => l.action.includes('import')).length,
      bulkOperations: logs.filter(l => l.action.includes('bulk')).length,
    };

    return {
      period,
      summary: {
        ...summary,
        uniqueActors: summary.uniqueActors.size,
      },
      topActions,
      topActors,
      dataAccess,
      securityEvents: securityEvents.slice(0, 20), // Limit to recent 20
    };
  }

  /**
   * Get audit statistics
   */
  async getStatistics(days = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.auditLog.groupBy({
      by: ['category', 'actorType'],
      _count: true,
      where: {
        createdAt: { gte: startDate },
      },
    });

    const dailyStats = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        category,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at), category
      ORDER BY date DESC
    `;

    return {
      byCategory: stats.reduce((acc, stat) => {
        if (!acc[stat.category]) acc[stat.category] = 0;
        acc[stat.category] += stat._count;
        return acc;
      }, {} as Record<string, number>),
      byActorType: stats.reduce((acc, stat) => {
        if (!acc[stat.actorType]) acc[stat.actorType] = 0;
        acc[stat.actorType] += stat._count;
        return acc;
      }, {} as Record<string, number>),
      dailyStats,
    };
  }

  // Private helper methods

  private async writeToFile(entry: AuditLog): Promise<void> {
    const date = new Date();
    const filename = `audit-${date.toISOString().split('T')[0]}.jsonl`;
    const filepath = path.join(this.auditDir, filename);

    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(filepath, line);
  }

  private async checkCriticalEvents(entry: AuditLog): Promise<void> {
    const criticalActions = [
      'user-deleted',
      'data-export',
      'backup-restore',
      'emergency-rollback',
      'security-breach',
      'unauthorized-access',
    ];

    if (criticalActions.includes(entry.action) || entry.category === 'security') {
      // Send alert for critical events
      const { alertingService } = await import('./alerting-service');
      
      await alertingService.sendAlert({
        id: `critical-audit-${entry.id}`,
        severity: 'warning',
        type: 'audit-critical',
        message: `Critical audit event: ${entry.action}`,
        timestamp: entry.timestamp,
        acknowledged: false,
        resolved: false,
        metadata: {
          auditId: entry.id,
          category: entry.category,
          action: entry.action,
          actorId: entry.actorId,
          targetId: entry.targetId,
        },
      });
    }
  }

  /**
   * Helper method to log data changes
   */
  async logDataChange(
    entityType: string,
    entityId: string,
    changes: { before: any; after: any },
    actorId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      category: 'data',
      action: `${entityType}-updated`,
      actorId,
      actorType: actorId ? 'user' : 'system',
      targetId: entityId,
      targetType: entityType,
      changes,
      metadata,
    });
  }

  /**
   * Helper method to log API access
   */
  async logAPIAccess(
    endpoint: string,
    method: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    responseStatus?: number,
    responseTime?: number
  ): Promise<void> {
    await this.log({
      category: 'api',
      action: `api-${method.toLowerCase()}`,
      actorId: userId,
      actorType: userId ? 'user' : 'anonymous',
      metadata: {
        endpoint,
        method,
        responseStatus,
        responseTime,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper method to log security events
   */
  async logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: any,
    actorId?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      category: 'security',
      action: event,
      actorId,
      actorType: actorId ? 'user' : 'system',
      metadata: {
        severity,
        ...details,
      },
      ipAddress,
    });
  }
}

// Export singleton instance
export const auditService = new AuditService();