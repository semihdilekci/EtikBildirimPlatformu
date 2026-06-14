import type { PrismaClient } from '@prisma/client';
import {
  IN_APP_NOTIFICATION_RETENTION_DAYS,
  RETENTION_PURGE_CRON_INTERVAL_MS,
} from '@ethics/shared';

export { RETENTION_PURGE_CRON_INTERVAL_MS };

export interface RetentionPurgeResult {
  candidatesScanned: number;
  purgedCount: number;
  skippedLegalHoldCount: number;
}

export interface RetentionPurgeClock {
  now(): Date;
}

/**
 * Okunmuş in-app bildirimlerin retention temizliği.
 * legal_hold_flag aktif vakaya bağlı bildirimler atlanır.
 */
export class RetentionPurgeJob {
  private lastRunAt = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly retentionDays: number = IN_APP_NOTIFICATION_RETENTION_DAYS,
    private readonly intervalMs: number = RETENTION_PURGE_CRON_INTERVAL_MS,
    private readonly clock: RetentionPurgeClock = { now: () => new Date() },
  ) {}

  async runIfDue(nowMs: number = Date.now()): Promise<RetentionPurgeResult | null> {
    if (this.lastRunAt > 0 && nowMs - this.lastRunAt < this.intervalMs) {
      return null;
    }

    this.lastRunAt = nowMs;
    return this.run(this.clock.now());
  }

  async run(now: Date = this.clock.now()): Promise<RetentionPurgeResult> {
    const cutoff = new Date(now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.notification.findMany({
      where: {
        isRead: true,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        caseId: true,
      },
    });

    const linkedCaseIds = [
      ...new Set(
        candidates
          .map((candidate) => candidate.caseId)
          .filter((caseId): caseId is string => caseId !== null),
      ),
    ];

    const legalHoldCaseIds = new Set<string>();
    if (linkedCaseIds.length > 0) {
      const heldCases = await this.prisma.case.findMany({
        where: {
          id: { in: linkedCaseIds },
          legalHoldFlag: true,
        },
        select: { id: true },
      });

      for (const heldCase of heldCases) {
        legalHoldCaseIds.add(heldCase.id);
      }
    }

    const purgeIds: string[] = [];
    let skippedLegalHoldCount = 0;

    for (const candidate of candidates) {
      if (candidate.caseId && legalHoldCaseIds.has(candidate.caseId)) {
        skippedLegalHoldCount += 1;
        continue;
      }

      purgeIds.push(candidate.id);
    }

    if (purgeIds.length > 0) {
      await this.prisma.notification.deleteMany({
        where: { id: { in: purgeIds } },
      });
    }

    return {
      candidatesScanned: candidates.length,
      purgedCount: purgeIds.length,
      skippedLegalHoldCount,
    };
  }
}
