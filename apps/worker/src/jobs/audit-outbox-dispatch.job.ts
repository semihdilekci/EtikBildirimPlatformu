import type { Prisma, PrismaClient } from '@prisma/client';

const DISPATCH_PENDING = 'PENDING';
const DISPATCH_SENT = 'SENT';
const DISPATCH_FAILED = 'FAILED';
const DISPATCH_PERMANENTLY_FAILED = 'PERMANENTLY_FAILED';

const ADVISORY_LOCK_KEY = 8_739_282;
const DEFAULT_BATCH_SIZE = 50;
const MAX_RETRY_COUNT = 3;

export interface AuditOutboxDispatchItemResult {
  outboxId: string;
  status: 'sent' | 'already_sent' | 'skipped' | 'failed';
  auditEventId?: string;
  errorCode?: string;
}

export interface AuditOutboxDispatchResult {
  processed: number;
  sent: number;
  failed: number;
  items: AuditOutboxDispatchItemResult[];
}

export interface AuditOutboxDispatchJobOptions {
  batchSize?: number;
  maxRetryCount?: number;
}

type TransactionClient = Prisma.TransactionClient;

export class AuditOutboxDispatchJob {
  private readonly batchSize: number;
  private readonly maxRetryCount: number;

  constructor(
    private readonly prisma: PrismaClient,
    options: AuditOutboxDispatchJobOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxRetryCount = options.maxRetryCount ?? MAX_RETRY_COUNT;
  }

  async processPendingBatch(): Promise<AuditOutboxDispatchResult> {
    const pending = await this.prisma.auditOutbox.findMany({
      where: { dispatchStatus: DISPATCH_PENDING },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });

    const items: AuditOutboxDispatchItemResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const outbox of pending) {
      try {
        const item = await this.dispatchSingle(outbox.id);
        items.push(item);

        if (item.status === 'sent' || item.status === 'already_sent') {
          sent += 1;
        } else if (item.status === 'failed') {
          failed += 1;
        }
      } catch (error) {
        const errorCode =
          error instanceof Error ? error.message.slice(0, 120) : 'AUDIT_DISPATCH_FAILED';

        await this.markFailedStandalone(outbox.id, outbox.retryCount, errorCode);

        items.push({
          outboxId: outbox.id,
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
      items,
    };
  }

  private async dispatchSingle(outboxId: string): Promise<AuditOutboxDispatchItemResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;

      const outbox = await tx.auditOutbox.findUnique({
        where: { id: outboxId },
      });

      if (!outbox) {
        return { outboxId, status: 'skipped' };
      }

      if (outbox.dispatchStatus !== DISPATCH_PENDING) {
        return { outboxId, status: 'skipped' };
      }

      return this.dispatchOutboxRecord(tx, outbox);
    });
  }

  private async dispatchOutboxRecord(
    tx: TransactionClient,
    outbox: Prisma.AuditOutboxGetPayload<object>,
  ): Promise<AuditOutboxDispatchItemResult> {
    const existingEvent = await tx.auditEvent.findFirst({
      where: {
        metadataJson: {
          path: ['sourceOutboxId'],
          equals: outbox.id,
        },
      },
      select: { id: true },
    });

    if (existingEvent) {
      await tx.auditOutbox.update({
        where: { id: outbox.id },
        data: {
          dispatchStatus: DISPATCH_SENT,
          processedAt: new Date(),
          errorCode: null,
        },
      });

      return {
        outboxId: outbox.id,
        status: 'already_sent',
        auditEventId: existingEvent.id,
      };
    }

    const metadata = this.buildAuditEventMetadata(outbox);

    const auditEvent = await tx.auditEvent.create({
      data: {
        occurredAt: outbox.occurredAt,
        eventType: outbox.eventType,
        eventCategory: outbox.eventCategory,
        severity: outbox.severity,
        actorType: outbox.actorType,
        actorId: outbox.actorId,
        action: outbox.action,
        outcome: outbox.outcome,
        correlationId: outbox.correlationId,
        metadataJson: metadata,
      },
      select: { id: true },
    });

    await tx.auditOutbox.update({
      where: { id: outbox.id },
      data: {
        dispatchStatus: DISPATCH_SENT,
        processedAt: new Date(),
        errorCode: null,
      },
    });

    return {
      outboxId: outbox.id,
      status: 'sent',
      auditEventId: auditEvent.id,
    };
  }

  private buildAuditEventMetadata(
    outbox: Prisma.AuditOutboxGetPayload<object>,
  ): Prisma.InputJsonValue {
    const base =
      outbox.metadataJson !== null && typeof outbox.metadataJson === 'object'
        ? (outbox.metadataJson as Record<string, unknown>)
        : {};

    return {
      ...base,
      sourceOutboxId: outbox.id,
      ...(outbox.idempotencyKey ? { idempotencyKey: outbox.idempotencyKey } : {}),
    };
  }

  private async markFailedStandalone(
    outboxId: string,
    currentRetryCount: number,
    errorCode: string,
  ): Promise<void> {
    const nextRetryCount = currentRetryCount + 1;
    const dispatchStatus =
      nextRetryCount >= this.maxRetryCount ? DISPATCH_PERMANENTLY_FAILED : DISPATCH_FAILED;

    await this.prisma.auditOutbox.update({
      where: { id: outboxId },
      data: {
        dispatchStatus,
        retryCount: nextRetryCount,
        errorCode,
      },
    });
  }
}
