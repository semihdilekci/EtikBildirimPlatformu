import { HttpStatus } from '@nestjs/common';
import { AuditActorType, AuditEventType, AuditOutcome, ErrorCode } from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';
import { AuditEventPublisher } from '../audit-event.publisher.js';
import { AuditSealService } from '../audit-seal.service.js';

describe('Audit DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let publisher: AuditEventPublisher;
  let sealService: AuditSealService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    publisher = new AuditEventPublisher();
    sealService = new AuditSealService();
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('domain transaction içinde publish → audit_outbox PENDING kaydı oluşur', async () => {
    const correlationId = crypto.randomUUID();

    const outboxId = await environment.prisma.$transaction(async (tx) => {
      const record = await publisher.publish(tx, {
        eventType: AuditEventType.CASE_TRANSITION,
        actorType: AuditActorType.USER,
        actorId: 'user-integration-1',
        action: 'case_transition',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'case',
        resourceId: 'case-integration-1',
        correlationId,
        metadata: { fromState: 'PRE_REVIEW', toState: 'INVESTIGATION' },
        idempotencyKey: `idem-${correlationId}`,
      });

      return record.id;
    });

    const stored = await environment.prisma.auditOutbox.findUnique({
      where: { id: outboxId },
    });

    expect(stored).toMatchObject({
      eventType: AuditEventType.CASE_TRANSITION,
      eventCategory: 'WORKFLOW',
      dispatchStatus: 'PENDING',
      actorId: 'user-integration-1',
      resourceId: 'case-integration-1',
      correlationId,
    });
    expect(stored?.metadataJson).toEqual({
      fromState: 'PRE_REVIEW',
      toState: 'INVESTIGATION',
    });
  });

  it('fail-closed: transaction rollback olunca audit_outbox kaydı da silinir', async () => {
    const marker = crypto.randomUUID();

    await expect(
      environment.prisma.$transaction(async (tx) => {
        await publisher.publish(tx, {
          eventType: AuditEventType.AUTHZ_DENIED,
          actorType: AuditActorType.USER,
          actorId: 'user-integration-2',
          action: 'policy_denied',
          outcome: AuditOutcome.DENIED,
          correlationId: marker,
          idempotencyKey: `rollback-${marker}`,
        });

        throw new Error('simulated domain failure');
      }),
    ).rejects.toThrow('simulated domain failure');

    const count = await environment.prisma.auditOutbox.count({
      where: { correlationId: marker },
    });

    expect(count).toBe(0);
  });

  it('fail-closed: yasak metadata publish başarısız olunca transaction rollback olur', async () => {
    const marker = crypto.randomUUID();

    await expect(
      environment.prisma.$transaction(async (tx) => {
        await tx.company.create({
          data: {
            id: `company-${marker}`,
            code: `C-${marker.slice(0, 8)}`,
            name: 'Rollback Test Company',
          },
        });

        await publisher.publish(tx, {
          eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
          actorType: AuditActorType.USER,
          actorId: 'user-integration-3',
          action: 'system_setting_changed',
          outcome: AuditOutcome.SUCCESS,
          metadata: { report_text: 'plaintext leak attempt' },
        });
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUDIT_FORBIDDEN_CONTENT,
      status: HttpStatus.BAD_REQUEST,
    });

    const company = await environment.prisma.company.findUnique({
      where: { id: `company-${marker}` },
    });
    const outboxCount = await environment.prisma.auditOutbox.count({
      where: { actorId: 'user-integration-3' },
    });

    expect(company).toBeNull();
    expect(outboxCount).toBe(0);
  });

  it('aynı idempotency_key ikinci publish denemesi conflict üretir', async () => {
    const idempotencyKey = `dup-${crypto.randomUUID()}`;

    await environment.prisma.$transaction(async (tx) => {
      await publisher.publish(tx, {
        eventType: AuditEventType.TRACKING_VERIFY_ATTEMPT,
        actorType: AuditActorType.ANONYMOUS,
        action: 'tracking_verify',
        outcome: AuditOutcome.FAILURE,
        idempotencyKey,
      });
    });

    await expect(
      environment.prisma.$transaction(async (tx) => {
        await publisher.publish(tx, {
          eventType: AuditEventType.TRACKING_VERIFY_ATTEMPT,
          actorType: AuditActorType.ANONYMOUS,
          action: 'tracking_verify',
          outcome: AuditOutcome.FAILURE,
          idempotencyKey,
        });
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUDIT_PUBLISH_FAILED,
      status: HttpStatus.CONFLICT,
    });
  });

  describe('audit_events DB triggers (chain hash + append-only)', () => {
    const createAuditEvent = (suffix: string) =>
      environment.prisma.auditEvent.create({
        data: {
          id: `audit-event-${suffix}`,
          occurredAt: new Date('2026-06-13T10:00:00.000Z'),
          eventType: AuditEventType.CASE_TRANSITION,
          eventCategory: 'WORKFLOW',
          severity: 'INFO',
          actorType: AuditActorType.USER,
          actorId: `actor-${suffix}`,
          action: 'case_transition',
          outcome: AuditOutcome.SUCCESS,
          correlationId: `corr-${suffix}`,
        },
      });

    it('INSERT trigger prev_hash ve event_hash otomatik üretir', async () => {
      const event = await createAuditEvent('chain-1');

      expect(event.prevHash).toBeNull();
      expect(event.eventHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('hash-chain: ikinci event prev_hash bir önceki event_hash ile eşleşir', async () => {
      const first = await createAuditEvent('chain-2a');
      const second = await createAuditEvent('chain-2b');

      expect(second.prevHash).toBe(first.eventHash);
      expect(second.eventHash).toMatch(/^[a-f0-9]{64}$/);
      expect(second.eventHash).not.toBe(first.eventHash);

      const verification = await sealService.verifyChainIntegrity(
        sealService.createPrismaChainQuery(environment.prisma),
      );
      expect(verification.valid).toBe(true);
      expect(verification.eventCount).toBeGreaterThanOrEqual(2);
    });

    it('append-only: UPDATE audit_events DB hatası verir', async () => {
      const event = await createAuditEvent('immutable-update');

      await expect(
        environment.prisma.$executeRaw`
          UPDATE audit_events
          SET action = 'tampered'
          WHERE id = ${event.id}
        `,
      ).rejects.toThrow(/AUDIT_APPEND_ONLY_VIOLATION/);
    });

    it('append-only: DELETE audit_events DB hatası verir', async () => {
      const event = await createAuditEvent('immutable-delete');

      await expect(
        environment.prisma.$executeRaw`
          DELETE FROM audit_events
          WHERE id = ${event.id}
        `,
      ).rejects.toThrow(/AUDIT_APPEND_ONLY_VIOLATION/);
    });

    it('append-only: TRUNCATE audit_events DB hatası verir', async () => {
      await createAuditEvent('immutable-truncate');

      await expect(environment.prisma.$executeRaw`TRUNCATE TABLE audit_events`).rejects.toThrow(
        /AUDIT_APPEND_ONLY_VIOLATION/,
      );
    });
  });
});
