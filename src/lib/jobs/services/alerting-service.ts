import { prisma } from '@/server/db/prisma';
import { Alert } from '../types';
import { QueueManager } from '../queues';
import { JobQueue, JobPriority } from '../types';

export interface AlertChannel {
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'pagerduty';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldownMinutes?: number;
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  value: number | string;
  duration?: number; // Minutes the condition must be true
}

export interface AlertAction {
  channel: AlertChannel['type'];
  template?: string;
  recipients?: string[];
  config?: Record<string, any>;
}

export interface OnCallSchedule {
  id: string;
  name: string;
  users: OnCallUser[];
  rotation: 'daily' | 'weekly';
  startDate: Date;
}

export interface OnCallUser {
  userId: string;
  email: string;
  phone?: string;
  slackId?: string;
  priority: number;
}

export class AlertingService {
  private channels: Map<string, AlertChannel> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private onCallSchedules: Map<string, OnCallSchedule> = new Map();
  private alertHistory: Map<string, Date> = new Map();

  constructor() {
    this.initializeChannels();
    this.initializeRules();
  }

  private initializeChannels() {
    // Email channel
    this.channels.set('email', {
      type: 'email',
      enabled: !!process.env.SMTP_HOST,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        from: process.env.ALERT_EMAIL_FROM || 'alerts@pokemon-tcg.app',
      },
    });

    // Slack channel
    this.channels.set('slack', {
      type: 'slack',
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      },
    });

    // SMS channel (Twilio)
    this.channels.set('sms', {
      type: 'sms',
      enabled: !!process.env.TWILIO_ACCOUNT_SID,
      config: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
      },
    });

    // Webhook channel
    this.channels.set('webhook', {
      type: 'webhook',
      enabled: !!process.env.ALERT_WEBHOOK_URL,
      config: {
        url: process.env.ALERT_WEBHOOK_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.ALERT_WEBHOOK_AUTH,
        },
      },
    });

    // PagerDuty channel
    this.channels.set('pagerduty', {
      type: 'pagerduty',
      enabled: !!process.env.PAGERDUTY_API_KEY,
      config: {
        apiKey: process.env.PAGERDUTY_API_KEY,
        serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
      },
    });
  }

  private initializeRules() {
    // Default alert rules
    const defaultRules: AlertRule[] = [
      {
        id: 'database-down',
        name: 'Database Connection Failed',
        description: 'Alert when database is unreachable',
        conditions: [
          { metric: 'database.status', operator: 'eq', value: 'unhealthy' },
        ],
        actions: [
          { channel: 'pagerduty' },
          { channel: 'slack' },
          { channel: 'email', recipients: ['oncall'] },
        ],
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds threshold',
        conditions: [
          { metric: 'jobQueue.errorRate', operator: 'gt', value: 15, duration: 5 },
        ],
        actions: [
          { channel: 'slack' },
          { channel: 'email', recipients: ['dev-team'] },
        ],
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30,
      },
      {
        id: 'storage-full',
        name: 'Storage Nearly Full',
        description: 'Alert when storage usage is critical',
        conditions: [
          { metric: 'storage.usagePercent', operator: 'gt', value: 90 },
        ],
        actions: [
          { channel: 'pagerduty' },
          { channel: 'slack' },
        ],
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 60,
      },
      {
        id: 'api-degraded',
        name: 'External API Degraded',
        description: 'Alert when external APIs are slow or failing',
        conditions: [
          { metric: 'api.responseTime', operator: 'gt', value: 2000, duration: 10 },
        ],
        actions: [
          { channel: 'slack' },
        ],
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 15,
      },
      {
        id: 'backup-failed',
        name: 'Backup Job Failed',
        description: 'Alert when backup jobs fail',
        conditions: [
          { metric: 'backup.status', operator: 'eq', value: 'failed' },
        ],
        actions: [
          { channel: 'email', recipients: ['admin'] },
          { channel: 'slack' },
        ],
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 0, // Alert every time
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Send an alert through configured channels
   */
  async sendAlert(alert: Alert, channels?: AlertChannel['type'][]): Promise<void> {
    // Store alert in database
    const dbAlert = await prisma.alert.create({
      data: {
        alertId: alert.id,
        severity: alert.severity,
        type: alert.type,
        message: alert.message,
        metadata: alert.metadata || {},
      },
    });

    // Determine which channels to use
    const channelsToUse = channels || this.getChannelsForSeverity(alert.severity);

    // Send through each channel
    const sendPromises = channelsToUse.map(channelType => {
      const channel = this.channels.get(channelType);
      if (channel && channel.enabled) {
        return this.sendThroughChannel(alert, channel);
      }
      return Promise.resolve();
    });

    await Promise.allSettled(sendPromises);

    // Check if alert matches any rules for additional actions
    await this.checkAlertRules(alert);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await prisma.alert.update({
      where: { alertId },
      data: {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      },
    });

    // Cancel any escalations
    await this.cancelEscalations(alertId);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    await prisma.alert.update({
      where: { alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });

    // Send resolution notification
    const alert = await prisma.alert.findUnique({
      where: { alertId },
    });

    if (alert) {
      await this.sendResolutionNotification(alert);
    }
  }

  /**
   * Get on-call person
   */
  async getOnCallPerson(): Promise<OnCallUser | null> {
    const primarySchedule = Array.from(this.onCallSchedules.values())[0];
    
    if (!primarySchedule) {
      return null;
    }

    const daysSinceStart = Math.floor(
      (Date.now() - primarySchedule.startDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    const rotationPeriod = primarySchedule.rotation === 'daily' ? 1 : 7;
    const currentIndex = Math.floor(daysSinceStart / rotationPeriod) % primarySchedule.users.length;

    return primarySchedule.users[currentIndex];
  }

  /**
   * Create or update an on-call schedule
   */
  async setOnCallSchedule(schedule: OnCallSchedule): Promise<void> {
    this.onCallSchedules.set(schedule.id, schedule);
    
    // Store in database
    await prisma.onCallSchedule.upsert({
      where: { id: schedule.id },
      create: {
        id: schedule.id,
        name: schedule.name,
        rotation: schedule.rotation,
        startDate: schedule.startDate,
        users: schedule.users as any,
      },
      update: {
        name: schedule.name,
        rotation: schedule.rotation,
        startDate: schedule.startDate,
        users: schedule.users as any,
      },
    });
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    filters?: {
      severity?: Alert['severity'];
      type?: string;
      startDate?: Date;
      endDate?: Date;
      resolved?: boolean;
    }
  ): Promise<Alert[]> {
    const where: any = {};

    if (filters?.severity) where.severity = filters.severity;
    if (filters?.type) where.type = filters.type;
    if (filters?.resolved !== undefined) where.resolved = filters.resolved;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return alerts.map(a => ({
      id: a.alertId,
      severity: a.severity as Alert['severity'],
      type: a.type,
      message: a.message,
      timestamp: a.createdAt,
      acknowledged: a.acknowledged,
      acknowledgedBy: a.acknowledgedBy || undefined,
      acknowledgedAt: a.acknowledgedAt || undefined,
      resolved: a.resolved,
      resolvedAt: a.resolvedAt || undefined,
      metadata: a.metadata as Record<string, any>,
    }));
  }

  /**
   * Test alert channel
   */
  async testChannel(channelType: AlertChannel['type']): Promise<boolean> {
    const channel = this.channels.get(channelType);
    
    if (!channel || !channel.enabled) {
      return false;
    }

    const testAlert: Alert = {
      id: `test-${Date.now()}`,
      severity: 'info',
      type: 'test',
      message: `This is a test alert for ${channelType} channel`,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };

    try {
      await this.sendThroughChannel(testAlert, channel);
      return true;
    } catch (error) {
      console.error(`Failed to test ${channelType} channel:`, error);
      return false;
    }
  }

  // Private helper methods

  private getChannelsForSeverity(severity: Alert['severity']): AlertChannel['type'][] {
    switch (severity) {
      case 'critical':
        return ['pagerduty', 'sms', 'slack', 'email'];
      case 'warning':
        return ['slack', 'email'];
      case 'info':
        return ['slack'];
      default:
        return ['slack'];
    }
  }

  private async sendThroughChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailAlert(alert, channel);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, channel);
        break;
      case 'sms':
        await this.sendSMSAlert(alert, channel);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, channel);
        break;
      case 'pagerduty':
        await this.sendPagerDutyAlert(alert, channel);
        break;
    }
  }

  private async sendEmailAlert(alert: Alert, channel: AlertChannel) {
    // Queue email job
    await QueueManager.addJob(
      JobQueue.NOTIFICATION,
      'send-email',
      {
        to: await this.getEmailRecipients(alert),
        subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
        html: this.formatEmailAlert(alert),
      },
      {
        priority: alert.severity === 'critical' ? JobPriority.CRITICAL : JobPriority.HIGH,
      }
    );
  }

  private async sendSlackAlert(alert: Alert, channel: AlertChannel) {
    const color = {
      critical: 'danger',
      warning: 'warning',
      info: 'good',
    }[alert.severity];

    const payload = {
      channel: channel.config.channel,
      attachments: [{
        color,
        title: `${alert.severity.toUpperCase()}: ${alert.type}`,
        text: alert.message,
        fields: Object.entries(alert.metadata || {}).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true,
        })),
        footer: 'Pokemon TCG Alert System',
        ts: Math.floor(alert.timestamp.getTime() / 1000),
      }],
    };

    // Send to Slack webhook
    await fetch(channel.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async sendSMSAlert(alert: Alert, channel: AlertChannel) {
    const onCall = await this.getOnCallPerson();
    
    if (!onCall?.phone) {
      console.error('No on-call person with phone number found');
      return;
    }

    // Queue SMS job
    await QueueManager.addJob(
      JobQueue.NOTIFICATION,
      'send-sms',
      {
        to: onCall.phone,
        message: `[${alert.severity.toUpperCase()}] ${alert.message}`,
        twilioConfig: channel.config,
      },
      {
        priority: JobPriority.CRITICAL,
      }
    );
  }

  private async sendWebhookAlert(alert: Alert, channel: AlertChannel) {
    await fetch(channel.config.url, {
      method: 'POST',
      headers: channel.config.headers,
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString(),
        source: 'pokemon-tcg-alerts',
      }),
    });
  }

  private async sendPagerDutyAlert(alert: Alert, channel: AlertChannel) {
    const event = {
      routing_key: channel.config.serviceKey,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.message,
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
        source: 'pokemon-tcg',
        custom_details: alert.metadata,
      },
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token token=${channel.config.apiKey}`,
      },
      body: JSON.stringify(event),
    });
  }

  private async getEmailRecipients(alert: Alert): Promise<string[]> {
    const recipients: string[] = [];

    // Add admin emails for critical alerts
    if (alert.severity === 'critical') {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['admin', 'super_admin'] } },
        select: { email: true },
      });
      recipients.push(...admins.map(a => a.email));
    }

    // Add on-call person
    const onCall = await this.getOnCallPerson();
    if (onCall?.email) {
      recipients.push(onCall.email);
    }

    // Add configured recipients
    const configuredEmails = process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [];
    recipients.push(...configuredEmails);

    return [...new Set(recipients)]; // Remove duplicates
  }

  private formatEmailAlert(alert: Alert): string {
    return `
      <h2 style="color: ${alert.severity === 'critical' ? '#d32f2f' : '#f57c00'}">
        ${alert.severity.toUpperCase()} Alert: ${alert.type}
      </h2>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
      ${alert.metadata ? `
        <h3>Details:</h3>
        <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
      ` : ''}
      <hr>
      <p>
        <a href="${process.env.APP_URL}/admin/alerts/${alert.id}">View Alert</a> |
        <a href="${process.env.APP_URL}/admin/alerts/${alert.id}/acknowledge">Acknowledge</a>
      </p>
    `;
  }

  private async checkAlertRules(alert: Alert) {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTriggeredKey = `rule:${rule.id}:lastTriggered`;
      const lastTriggered = this.alertHistory.get(lastTriggeredKey);
      
      if (lastTriggered && rule.cooldownMinutes) {
        const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000);
        if (new Date() < cooldownEnd) {
          continue;
        }
      }

      // Check conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions, alert);
      
      if (conditionsMet) {
        // Execute actions
        for (const action of rule.actions) {
          await this.executeAction(action, alert);
        }

        // Update last triggered
        this.alertHistory.set(lastTriggeredKey, new Date());
      }
    }
  }

  private async evaluateConditions(conditions: AlertCondition[], alert: Alert): Promise<boolean> {
    // This is simplified - in production, you'd evaluate against actual metrics
    return conditions.every(condition => {
      const value = this.getMetricValue(condition.metric, alert);
      return this.compareValues(value, condition.operator, condition.value);
    });
  }

  private getMetricValue(metric: string, alert: Alert): any {
    // Extract metric value from alert metadata
    const parts = metric.split('.');
    let value: any = alert.metadata;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'eq': return actual === expected;
      case 'neq': return actual !== expected;
      default: return false;
    }
  }

  private async executeAction(action: AlertAction, alert: Alert) {
    await this.sendAlert(alert, [action.channel]);
  }

  private async cancelEscalations(alertId: string) {
    // Cancel any scheduled escalation jobs
    // This would integrate with the job queue system
  }

  private async sendResolutionNotification(alert: any) {
    const resolutionAlert: Alert = {
      id: `${alert.alertId}-resolved`,
      severity: 'info',
      type: 'alert-resolved',
      message: `Alert resolved: ${alert.message}`,
      timestamp: new Date(),
      acknowledged: true,
      resolved: true,
      metadata: {
        originalAlertId: alert.alertId,
        resolvedAt: alert.resolvedAt,
        resolvedBy: alert.resolvedBy,
      },
    };

    await this.sendAlert(resolutionAlert, ['slack', 'email']);
  }
}

// Export singleton instance
export const alertingService = new AlertingService();