import type { PrismaClient } from '@prisma/client';
import { AUDIT_CHAIN_VERIFY_CRON_INTERVAL_MS } from '@ethics/shared';

import {
  AuditChainVerifier,
  type AuditChainVerificationResult,
} from '../audit/audit-chain-verifier.js';

export { AUDIT_CHAIN_VERIFY_CRON_INTERVAL_MS };

export interface AuditChainVerifyJobResult extends AuditChainVerificationResult {
  alarmRaised: boolean;
}

export interface AuditChainVerifyLogger {
  warn(context: Record<string, unknown>, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
}

const defaultLogger: AuditChainVerifyLogger = {
  warn(context, message) {
    console.warn(JSON.stringify({ level: 'warn', ...context, msg: message }));
  },
  info(context, message) {
    console.warn(JSON.stringify({ level: 'info', ...context, msg: message }));
  },
};

/**
 * Periyodik chain hash bütünlük doğrulama (cron schedule Faz 8 — günlük).
 * Bozulma tespit edilirse structured alarm log üretir.
 */
export class AuditChainVerifyJob {
  private lastRunAt = 0;
  private readonly verifier = new AuditChainVerifier();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AuditChainVerifyLogger = defaultLogger,
    private readonly intervalMs: number = AUDIT_CHAIN_VERIFY_CRON_INTERVAL_MS,
  ) {}

  async runIfDue(nowMs: number = Date.now()): Promise<AuditChainVerifyJobResult | null> {
    if (this.lastRunAt > 0 && nowMs - this.lastRunAt < this.intervalMs) {
      return null;
    }

    this.lastRunAt = nowMs;
    return this.run();
  }

  async run(): Promise<AuditChainVerifyJobResult> {
    const verification = await this.verifier.verify(
      this.verifier.createPrismaChainQuery(this.prisma),
    );

    if (verification.valid) {
      this.logger.info(
        { eventCount: verification.eventCount, job: 'audit-chain-verify' },
        'Audit chain verification passed',
      );

      return { ...verification, alarmRaised: false };
    }

    this.logger.warn(
      {
        job: 'audit-chain-verify',
        eventCount: verification.eventCount,
        brokenAtEventId: verification.brokenAtEventId,
        alarm: 'AUDIT_CHAIN_INTEGRITY_FAILURE',
      },
      'Audit chain verification failed',
    );

    return { ...verification, alarmRaised: true };
  }
}
