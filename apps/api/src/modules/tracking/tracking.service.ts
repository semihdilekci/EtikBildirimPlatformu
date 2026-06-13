import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  REPORT_STATUS_LABELS,
  type ReportStatusCode,
} from '@ethics/shared';
import type { Request } from 'express';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import type { AuditTransactionClient } from '../../audit/audit.types.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { maskTrackingCode } from './tracking-code-mask.util.js';
import { TrackingAttemptService } from './tracking-attempt.service.js';
import { SecureMessageService } from './secure-message.service.js';
import { TrackingCredentialService } from './tracking-credential.service.js';
import type { TrackingStatusResult, TrackingVerifyResult } from './tracking.types.js';

function resolveClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? request.ip ?? 'unknown';
  }

  return request.ip ?? 'unknown';
}

@Injectable()
export class TrackingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TrackingCredentialService)
    private readonly trackingCredentialService: TrackingCredentialService,
    @Inject(TrackingAttemptService)
    private readonly trackingAttemptService: TrackingAttemptService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(SecureMessageService) private readonly secureMessageService: SecureMessageService,
  ) {}

  async verify(request: Request, correlationId: string): Promise<TrackingVerifyResult> {
    const ipAddress = resolveClientIp(request);
    const { trackingCode, password } = this.trackingCredentialService.extractCredentials(request);

    await this.trackingAttemptService.assertNotLocked(ipAddress, trackingCode);

    const reportContext = await this.trackingCredentialService.authenticate(trackingCode, password);

    if (!reportContext) {
      await this.publishVerifyAttempt({
        correlationId,
        ipAddress,
        trackingCode,
        outcome: AuditOutcome.FAILURE,
        companyId: undefined,
        reportId: undefined,
        onAttemptRecorded: async (tx) => {
          const lockResult = await this.trackingAttemptService.recordFailure(
            ipAddress,
            trackingCode,
            tx,
          );

          if (lockResult.lockoutTriggered) {
            await this.auditPublisher.publish(tx, {
              eventType: AuditEventType.TRACKING_AUTH_FAILED,
              actorType: AuditActorType.ANONYMOUS,
              action: 'tracking_auth_failed',
              outcome: AuditOutcome.FAILURE,
              resourceType: 'report',
              correlationId,
              metadata: {
                tracking_code_masked: maskTrackingCode(trackingCode),
                ip_address_hash: this.trackingAttemptService.hashIpAddress(ipAddress),
                attempt_count: lockResult.failedCount,
                lockout_triggered: true,
              },
              idempotencyKey: `tracking-auth-failed:${correlationId}`,
            });
          }

          return lockResult;
        },
      });

      throw new DomainException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Takip kodu veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.publishVerifyAttempt({
      correlationId,
      ipAddress,
      trackingCode,
      outcome: AuditOutcome.SUCCESS,
      companyId: reportContext.companyId,
      reportId: reportContext.reportId,
      onAttemptRecorded: async (tx) => {
        await this.trackingAttemptService.recordSuccess(ipAddress, trackingCode, tx);
        return {
          failedCount: 0,
          lockedUntil: null,
          lockoutTriggered: false,
        };
      },
    });

    const hasUnreadMessages = await this.secureMessageService.hasUnreadInboundMessages(
      reportContext.reportId,
    );

    return {
      verified: true,
      reportStatus: reportContext.status,
      hasUnreadMessages,
      submittedAt: reportContext.submittedAt.toISOString(),
    };
  }

  getStatus(request: Request): TrackingStatusResult {
    const reportContext = request.trackingReport;

    if (!reportContext) {
      throw new DomainException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Takip kodu veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const status = reportContext.status as ReportStatusCode;

    return {
      trackingCode: reportContext.trackingCode,
      status,
      statusLabel: REPORT_STATUS_LABELS[status],
      submittedAt: reportContext.submittedAt.toISOString(),
      lastActivityAt: reportContext.lastActivityAt?.toISOString() ?? null,
    };
  }

  private async publishVerifyAttempt(input: {
    correlationId: string;
    ipAddress: string;
    trackingCode: string;
    outcome: typeof AuditOutcome.SUCCESS | typeof AuditOutcome.FAILURE;
    companyId?: string;
    reportId?: string;
    onAttemptRecorded: (tx: AuditTransactionClient) => Promise<{
      failedCount: number;
      lockedUntil: Date | null;
      lockoutTriggered: boolean;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lockResult = await input.onAttemptRecorded(tx);

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.TRACKING_VERIFY_ATTEMPT,
        actorType: AuditActorType.ANONYMOUS,
        action: 'tracking_verify',
        outcome: input.outcome,
        resourceType: 'report',
        resourceId: input.reportId,
        companyId: input.companyId,
        correlationId: input.correlationId,
        metadata: {
          tracking_code_masked: maskTrackingCode(input.trackingCode),
          ip_address_hash: this.trackingAttemptService.hashIpAddress(input.ipAddress),
          attempt_count: lockResult.failedCount,
          lockout_triggered: lockResult.lockoutTriggered,
        },
        idempotencyKey: `tracking-verify:${input.correlationId}`,
      });
    });
  }
}
