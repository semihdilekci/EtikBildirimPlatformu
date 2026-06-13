import type { PrismaClient } from '@prisma/client';

import {
  AuditChainVerifier,
  type AuditChainVerificationResult,
} from '../audit/audit-chain-verifier.js';

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
    // Worker structured log — CLI çıktısı
    console.warn(JSON.stringify({ level: 'info', ...context, msg: message }));
  },
};

/**
 * Periyodik chain hash bütünlük doğrulama (cron schedule Faz 8).
 * Bozulma tespit edilirse structured alarm log üretir.
 */
export class AuditChainVerifyJob {
  private readonly verifier = new AuditChainVerifier();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AuditChainVerifyLogger = defaultLogger,
  ) {}

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
