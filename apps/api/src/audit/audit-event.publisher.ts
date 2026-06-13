import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@ethics/shared';

import { DomainException } from '../common/exceptions/domain.exception.js';
import {
  AUDIT_EVENT_CATEGORY_BY_TYPE,
  AUDIT_EVENT_DEFAULT_SEVERITY,
  AUDIT_OUTBOX_DISPATCH_PENDING,
} from './audit.constants.js';
import { findForbiddenAuditMetadataKey } from './audit-metadata.validator.js';
import type {
  AuditTransactionClient,
  PublishAuditEventInput,
  PublishedAuditOutboxRecord,
} from './audit.types.js';

@Injectable()
export class AuditEventPublisher {
  async publish(
    tx: AuditTransactionClient,
    input: PublishAuditEventInput,
  ): Promise<PublishedAuditOutboxRecord> {
    this.assertMetadataSafe(input.metadata);

    const eventCategory = input.eventCategory ?? AUDIT_EVENT_CATEGORY_BY_TYPE[input.eventType];
    const severity = input.severity ?? AUDIT_EVENT_DEFAULT_SEVERITY[input.eventType];

    try {
      const record = await tx.auditOutbox.create({
        data: {
          occurredAt: input.occurredAt ?? new Date(),
          eventType: input.eventType,
          eventCategory,
          severity,
          actorType: input.actorType,
          actorId: input.actorId,
          action: input.action,
          outcome: input.outcome,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          caseId: input.caseId,
          companyId: input.companyId,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          metadataJson: input.metadata ? (input.metadata as object) : undefined,
          dispatchStatus: AUDIT_OUTBOX_DISPATCH_PENDING,
        },
        select: {
          id: true,
          eventType: true,
          dispatchStatus: true,
        },
      });

      return {
        id: record.id,
        eventType: record.eventType as PublishAuditEventInput['eventType'],
        dispatchStatus: record.dispatchStatus,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.idempotencyKey
      ) {
        throw new DomainException(
          ErrorCode.AUDIT_PUBLISH_FAILED,
          'Audit outbox idempotency key already exists.',
          HttpStatus.CONFLICT,
        );
      }

      throw new DomainException(
        ErrorCode.AUDIT_PUBLISH_FAILED,
        'Failed to publish audit outbox event.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private assertMetadataSafe(metadata: Record<string, unknown> | undefined): void {
    if (!metadata) {
      return;
    }

    const forbiddenKey = findForbiddenAuditMetadataKey(metadata);
    if (forbiddenKey) {
      throw new DomainException(
        ErrorCode.AUDIT_FORBIDDEN_CONTENT,
        `Audit metadata contains forbidden key: ${forbiddenKey}.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
