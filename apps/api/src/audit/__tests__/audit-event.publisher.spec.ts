import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditActorType, AuditEventType, AuditOutcome, ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import { AuditEventPublisher } from '../audit-event.publisher.js';
import type { AuditTransactionClient } from '../audit.types.js';

function createTxMock(): AuditTransactionClient {
  return {
    auditOutbox: {
      create: vi.fn(),
    },
  } as unknown as AuditTransactionClient;
}

describe('AuditEventPublisher', () => {
  let publisher: AuditEventPublisher;
  let tx: AuditTransactionClient;

  beforeEach(() => {
    publisher = new AuditEventPublisher();
    tx = createTxMock();
  });

  it('publish audit_outbox kaydı PENDING dispatch_status ile oluşturur', async () => {
    vi.mocked(tx.auditOutbox.create).mockResolvedValue({
      id: 'outbox-1',
      eventType: AuditEventType.CASE_TRANSITION,
      dispatchStatus: 'PENDING',
    } as Awaited<ReturnType<AuditTransactionClient['auditOutbox']['create']>>);

    const result = await publisher.publish(tx, {
      eventType: AuditEventType.CASE_TRANSITION,
      actorType: AuditActorType.USER,
      actorId: 'user-1',
      action: 'case_transition',
      outcome: AuditOutcome.SUCCESS,
      resourceType: 'case',
      resourceId: 'case-1',
      correlationId: 'corr-1',
      metadata: { fromState: 'PRE_REVIEW', toState: 'INVESTIGATION' },
    });

    expect(result).toEqual({
      id: 'outbox-1',
      eventType: AuditEventType.CASE_TRANSITION,
      dispatchStatus: 'PENDING',
    });

    expect(tx.auditOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: AuditEventType.CASE_TRANSITION,
          eventCategory: 'WORKFLOW',
          severity: 'INFO',
          actorType: AuditActorType.USER,
          actorId: 'user-1',
          dispatchStatus: 'PENDING',
          metadataJson: { fromState: 'PRE_REVIEW', toState: 'INVESTIGATION' },
        }),
      }),
    );
  });

  it('metadata içinde yasak anahtar varsa AUDIT_FORBIDDEN_CONTENT fırlatır', async () => {
    await expect(
      publisher.publish(tx, {
        eventType: AuditEventType.CASE_VIEWED,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: 'case_viewed',
        outcome: AuditOutcome.ALLOWED,
        metadata: { report_text: 'Gizli metin' },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUDIT_FORBIDDEN_CONTENT,
      status: HttpStatus.BAD_REQUEST,
    });

    expect(tx.auditOutbox.create).not.toHaveBeenCalled();
  });

  it('iç içe metadata yasak anahtarı recursive olarak reddeder', async () => {
    await expect(
      publisher.publish(tx, {
        eventType: AuditEventType.DOCUMENT_DOWNLOADED,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: 'document_downloaded',
        outcome: AuditOutcome.DENIED,
        metadata: {
          context: {
            nested: {
              password: 'secret',
            },
          },
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUDIT_FORBIDDEN_CONTENT,
    });
  });

  it('duplicate idempotency_key AUDIT_PUBLISH_FAILED (409) fırlatır', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

    vi.mocked(tx.auditOutbox.create).mockRejectedValue(prismaError);

    await expect(
      publisher.publish(tx, {
        eventType: AuditEventType.CASE_TRANSITION,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: 'case_transition',
        outcome: AuditOutcome.SUCCESS,
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUDIT_PUBLISH_FAILED,
      status: HttpStatus.CONFLICT,
    });
  });

  it('beklenmeyen DB hatası AUDIT_PUBLISH_FAILED (500) fırlatır', async () => {
    vi.mocked(tx.auditOutbox.create).mockRejectedValue(new Error('db down'));

    await expect(
      publisher.publish(tx, {
        eventType: AuditEventType.AUTHZ_DENIED,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: 'policy_denied',
        outcome: AuditOutcome.DENIED,
      }),
    ).rejects.toBeInstanceOf(DomainException);
  });
});

describe('findForbiddenAuditMetadataKey', () => {
  it('yasak anahtar listesindeki alanları yakalar', async () => {
    const { findForbiddenAuditMetadataKey } = await import('../audit-metadata.validator.js');

    expect(findForbiddenAuditMetadataKey({ token: 'abc' })).toBe('token');
    expect(findForbiddenAuditMetadataKey({ safe: { report_text: 'x' } })).toBe('safe.report_text');
    expect(findForbiddenAuditMetadataKey({ items: [{ password: 'x' }] })).toBe('items[0].password');
    expect(findForbiddenAuditMetadataKey({ caseId: 'case-1' })).toBeUndefined();
    expect(findForbiddenAuditMetadataKey(null)).toBeUndefined();
    expect(findForbiddenAuditMetadataKey([{ safe: true }])).toBeUndefined();
  });
});
