import type { Prisma, PrismaClient } from '@prisma/client';
import {
  NotificationChannel,
  NotificationTemplateCode,
  NOTIFICATION_DISPATCH_ADVISORY_LOCK_KEY,
  NOTIFICATION_DISPATCH_DEFAULT_MAX_RETRY_COUNT,
  NOTIFICATION_DISPATCH_PENDING,
  NOTIFICATION_DISPATCH_PERMANENTLY_FAILED,
  NOTIFICATION_DISPATCH_RETRYING,
  NOTIFICATION_DISPATCH_SENT,
  getNotificationRetryBackoffMs,
  renderNotificationEmailTemplate,
  resolveNotificationTemplateCode,
} from '@ethics/shared';

import type { EmailRelayPort } from '../email/email-relay.port.js';

const DEFAULT_BATCH_SIZE = 50;

const DISPATCHABLE_STATUSES = [
  NOTIFICATION_DISPATCH_PENDING,
  NOTIFICATION_DISPATCH_RETRYING,
] as const;

export interface NotificationDispatcherItemResult {
  eventId: string;
  status: 'sent' | 'already_sent' | 'skipped' | 'failed';
  notificationId?: string;
  emailMessageId?: string;
  errorCode?: string;
}

export interface NotificationDispatcherResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  items: NotificationDispatcherItemResult[];
}

export interface NotificationDispatcherJobOptions {
  batchSize?: number;
  maxRetryCount?: number;
  emailRelay?: EmailRelayPort | null;
}

type TransactionClient = Prisma.TransactionClient;

type NotificationEventRecord = Prisma.NotificationEventGetPayload<object>;

export class NotificationDispatcherJob {
  private readonly batchSize: number;
  private readonly maxRetryCount: number;
  private readonly emailRelay: EmailRelayPort | null;

  constructor(
    private readonly prisma: PrismaClient,
    options: NotificationDispatcherJobOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxRetryCount = options.maxRetryCount ?? NOTIFICATION_DISPATCH_DEFAULT_MAX_RETRY_COUNT;
    this.emailRelay = options.emailRelay ?? null;
  }

  async processPendingBatch(): Promise<NotificationDispatcherResult> {
    const candidates = await this.prisma.notificationEvent.findMany({
      where: {
        channel: {
          in: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        },
        OR: [
          { dispatchStatus: NOTIFICATION_DISPATCH_PENDING },
          {
            dispatchStatus: NOTIFICATION_DISPATCH_RETRYING,
            retryCount: { lt: this.maxRetryCount },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize * 4,
    });

    const pending = candidates
      .filter((event) => this.isEligibleForDispatch(event))
      .slice(0, this.batchSize);

    const items: NotificationDispatcherItemResult[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of pending) {
      try {
        const item = await this.dispatchSingle(event.id);
        items.push(item);

        if (item.status === 'sent' || item.status === 'already_sent') {
          sent += 1;
        } else if (item.status === 'failed') {
          failed += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        const errorCode =
          error instanceof Error ? error.message.slice(0, 120) : 'NOTIFICATION_DISPATCH_FAILED';

        await this.markFailedStandalone(event.id, event.retryCount, errorCode, event.metadataJson);

        items.push({
          eventId: event.id,
          status: 'failed',
          errorCode,
        });
        failed += 1;
      }
    }

    return {
      processed: pending.length,
      sent,
      failed,
      skipped,
      items,
    };
  }

  private async dispatchSingle(eventId: string): Promise<NotificationDispatcherItemResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NOTIFICATION_DISPATCH_ADVISORY_LOCK_KEY})`;

      const event = await tx.notificationEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return { eventId, status: 'skipped' };
      }

      if (
        !DISPATCHABLE_STATUSES.includes(
          event.dispatchStatus as (typeof DISPATCHABLE_STATUSES)[number],
        )
      ) {
        return { eventId, status: 'skipped' };
      }

      if (
        event.dispatchStatus === NOTIFICATION_DISPATCH_RETRYING &&
        !this.isEligibleForDispatch(event)
      ) {
        return { eventId, status: 'skipped' };
      }

      if (event.channel === NotificationChannel.EMAIL) {
        return this.dispatchEmailEvent(tx, event);
      }

      return this.dispatchInAppEvent(tx, event);
    });
  }

  private isEligibleForDispatch(event: NotificationEventRecord): boolean {
    if (event.dispatchStatus === NOTIFICATION_DISPATCH_PENDING) {
      return true;
    }

    if (event.dispatchStatus !== NOTIFICATION_DISPATCH_RETRYING) {
      return false;
    }

    if (event.retryCount >= this.maxRetryCount) {
      return false;
    }

    const lastAttemptAt = this.readLastAttemptAt(event.metadataJson) ?? event.createdAt;
    const backoffMs = getNotificationRetryBackoffMs(event.retryCount);
    return Date.now() - lastAttemptAt.getTime() >= backoffMs;
  }

  private async dispatchInAppEvent(
    tx: TransactionClient,
    event: NotificationEventRecord,
  ): Promise<NotificationDispatcherItemResult> {
    const existingNotification = await this.findDeliveredInAppNotification(tx, event);

    if (existingNotification) {
      await tx.notificationEvent.update({
        where: { id: event.id },
        data: {
          dispatchStatus: NOTIFICATION_DISPATCH_SENT,
          sentAt: new Date(),
          errorCode: null,
        },
      });

      return {
        eventId: event.id,
        status: 'already_sent',
        notificationId: existingNotification.id,
      };
    }

    if (!event.recipientUserId) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_MISSING_RECIPIENT');
    }

    const templateCode = resolveNotificationTemplateCode(event.eventType);
    if (!templateCode) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_UNKNOWN_EVENT_TYPE');
    }

    const template = await tx.notificationTemplate.findUnique({
      where: { templateCode },
      select: {
        templateCode: true,
        subjectTemplate: true,
        bodyTemplate: true,
        isActive: true,
        channel: true,
      },
    });

    if (!template?.isActive || template.channel !== NotificationChannel.IN_APP) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_TEMPLATE_UNAVAILABLE');
    }

    const metadata = this.readMetadata(event.metadataJson);
    const title = template.subjectTemplate ?? 'Bildirim';
    const body = template.bodyTemplate;

    const notification = await tx.notification.create({
      data: {
        userId: event.recipientUserId,
        templateCode: template.templateCode,
        title,
        body,
        caseId: event.caseId,
        taskId: typeof metadata.taskId === 'string' ? metadata.taskId : null,
      },
      select: { id: true },
    });

    await tx.notificationEvent.update({
      where: { id: event.id },
      data: {
        dispatchStatus: NOTIFICATION_DISPATCH_SENT,
        sentAt: new Date(),
        errorCode: null,
        templateId: event.templateId ?? template.templateCode,
      },
    });

    return {
      eventId: event.id,
      status: 'sent',
      notificationId: notification.id,
    };
  }

  private async dispatchEmailEvent(
    tx: TransactionClient,
    event: NotificationEventRecord,
  ): Promise<NotificationDispatcherItemResult> {
    if (event.recipientTrackingCode && !event.recipientUserId) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_EMAIL_NOT_ALLOWED');
    }

    if (!event.recipientUserId) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_MISSING_RECIPIENT');
    }

    if (!this.emailRelay) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_EMAIL_NOT_CONFIGURED');
    }

    const templateCode = resolveNotificationTemplateCode(event.eventType);
    if (!templateCode) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_UNKNOWN_EVENT_TYPE');
    }

    if (templateCode === NotificationTemplateCode.SECURE_MESSAGE_REPORTER) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_EMAIL_NOT_ALLOWED');
    }

    const template = await tx.notificationTemplate.findUnique({
      where: { templateCode },
      select: {
        templateCode: true,
        subjectTemplate: true,
        bodyTemplate: true,
        isActive: true,
        channel: true,
      },
    });

    if (!template?.isActive) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_TEMPLATE_UNAVAILABLE');
    }

    if (template.channel === NotificationChannel.SECURE_REPORTER_MESSAGE) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_EMAIL_NOT_ALLOWED');
    }

    const recipient = await tx.user.findUnique({
      where: { id: event.recipientUserId },
      select: { email: true, isActive: true },
    });

    if (!recipient?.isActive || !recipient.email) {
      return this.markFailedInTransaction(tx, event, 'NOTIFICATION_MISSING_RECIPIENT_EMAIL');
    }

    const rendered = renderNotificationEmailTemplate({
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
    });

    const sendResult = await this.emailRelay.sendEmail({
      to: recipient.email,
      subject: rendered.subject,
      textBody: rendered.textBody,
      htmlBody: rendered.htmlBody,
      correlationId: event.correlationId ?? event.id,
    });

    await tx.notificationEvent.update({
      where: { id: event.id },
      data: {
        dispatchStatus: NOTIFICATION_DISPATCH_SENT,
        sentAt: new Date(),
        errorCode: null,
        templateId: event.templateId ?? template.templateCode,
        metadataJson: this.mergeEmailMetadata(event.metadataJson, sendResult.messageId),
      },
    });

    return {
      eventId: event.id,
      status: 'sent',
      emailMessageId: sendResult.messageId,
    };
  }

  private async findDeliveredInAppNotification(
    tx: TransactionClient,
    event: NotificationEventRecord,
  ): Promise<{ id: string } | null> {
    if (!event.recipientUserId) {
      return null;
    }

    const templateCode = resolveNotificationTemplateCode(event.eventType);
    if (!templateCode) {
      return null;
    }

    const metadata = this.readMetadata(event.metadataJson);
    const taskId = typeof metadata.taskId === 'string' ? metadata.taskId : null;

    return tx.notification.findFirst({
      where: {
        userId: event.recipientUserId,
        templateCode,
        caseId: event.caseId,
        taskId,
        createdAt: {
          gte: event.createdAt,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }

  private async markFailedInTransaction(
    tx: TransactionClient,
    event: NotificationEventRecord,
    errorCode: string,
  ): Promise<NotificationDispatcherItemResult> {
    const nextRetryCount = event.retryCount + 1;
    const dispatchStatus =
      nextRetryCount >= this.maxRetryCount
        ? NOTIFICATION_DISPATCH_PERMANENTLY_FAILED
        : NOTIFICATION_DISPATCH_RETRYING;

    await tx.notificationEvent.update({
      where: { id: event.id },
      data: {
        dispatchStatus,
        retryCount: nextRetryCount,
        errorCode,
        metadataJson: this.mergeLastAttemptMetadata(event.metadataJson),
      },
    });

    return {
      eventId: event.id,
      status: 'failed',
      errorCode,
    };
  }

  private async markFailedStandalone(
    eventId: string,
    currentRetryCount: number,
    errorCode: string,
    metadataJson: Prisma.JsonValue | null,
  ): Promise<void> {
    const nextRetryCount = currentRetryCount + 1;
    const dispatchStatus =
      nextRetryCount >= this.maxRetryCount
        ? NOTIFICATION_DISPATCH_PERMANENTLY_FAILED
        : NOTIFICATION_DISPATCH_RETRYING;

    await this.prisma.notificationEvent.update({
      where: { id: eventId },
      data: {
        dispatchStatus,
        retryCount: nextRetryCount,
        errorCode,
        metadataJson: this.mergeLastAttemptMetadata(metadataJson),
      },
    });
  }

  private readMetadata(metadataJson: Prisma.JsonValue | null): Record<string, unknown> {
    if (metadataJson !== null && typeof metadataJson === 'object' && !Array.isArray(metadataJson)) {
      return metadataJson;
    }

    return {};
  }

  private readLastAttemptAt(metadataJson: Prisma.JsonValue | null): Date | null {
    const metadata = this.readMetadata(metadataJson);
    const value = metadata.lastAttemptAt;

    if (typeof value !== 'string') {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private mergeLastAttemptMetadata(metadataJson: Prisma.JsonValue | null): Prisma.InputJsonValue {
    const metadata = this.readMetadata(metadataJson);
    return {
      ...metadata,
      lastAttemptAt: new Date().toISOString(),
    };
  }

  private mergeEmailMetadata(
    metadataJson: Prisma.JsonValue | null,
    messageId: string,
  ): Prisma.InputJsonValue {
    const metadata = this.readMetadata(metadataJson);
    return {
      ...metadata,
      emailMessageId: messageId,
    };
  }
}
