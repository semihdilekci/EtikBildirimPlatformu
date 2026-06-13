import { AuditActorType, AuditEventType, AuditOutcome } from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditChainVerifier } from '../../audit/audit-chain-verifier.js';
import { AuditOutboxDispatchJob } from '../audit-outbox-dispatch.job.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';

describe('AuditOutboxDispatchJob integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let dispatchJob: AuditOutboxDispatchJob;
  const chainVerifier = new AuditChainVerifier();

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    dispatchJob = new AuditOutboxDispatchJob(environment.prisma);
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function seedPendingOutbox(suffix: string, idempotencyKey?: string) {
    return environment.prisma.auditOutbox.create({
      data: {
        occurredAt: new Date('2026-06-13T12:00:00.000Z'),
        eventType: AuditEventType.AUTHZ_DENIED,
        eventCategory: 'AUTHZ',
        severity: 'WARN',
        actorType: AuditActorType.USER,
        actorId: `worker-user-${suffix}`,
        action: 'policy_denied',
        outcome: AuditOutcome.DENIED,
        correlationId: `corr-${suffix}`,
        idempotencyKey,
        metadataJson: { permission: 'case:read' },
        dispatchStatus: 'PENDING',
      },
    });
  }

  it('PENDING outbox → dispatch → audit_events SENT + chain hash', async () => {
    const suffix = crypto.randomUUID();
    const outbox = await seedPendingOutbox(suffix, `worker-dispatch-${suffix}`);

    const result = await dispatchJob.processPendingBatch();

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(result.items.some((item) => item.outboxId === outbox.id && item.status === 'sent')).toBe(
      true,
    );

    const updatedOutbox = await environment.prisma.auditOutbox.findUnique({
      where: { id: outbox.id },
    });
    expect(updatedOutbox?.dispatchStatus).toBe('SENT');
    expect(updatedOutbox?.processedAt).not.toBeNull();

    const auditEvent = await environment.prisma.auditEvent.findFirst({
      where: {
        metadataJson: {
          path: ['sourceOutboxId'],
          equals: outbox.id,
        },
      },
    });

    expect(auditEvent).toMatchObject({
      eventType: AuditEventType.AUTHZ_DENIED,
      actorId: `worker-user-${suffix}`,
      outcome: AuditOutcome.DENIED,
      correlationId: `corr-${suffix}`,
    });
    expect(auditEvent?.eventHash).toMatch(/^[a-f0-9]{64}$/);

    const verification = await chainVerifier.verify(
      chainVerifier.createPrismaChainQuery(environment.prisma),
    );
    expect(verification.valid).toBe(true);
  });

  it('aynı outbox ikinci dispatch denemesinde çift audit_event oluşturmaz', async () => {
    const suffix = crypto.randomUUID();
    const outbox = await seedPendingOutbox(suffix, `worker-idem-${suffix}`);

    await dispatchJob.processPendingBatch();
    await dispatchJob.processPendingBatch();

    const eventCount = await environment.prisma.auditEvent.count({
      where: {
        metadataJson: {
          path: ['sourceOutboxId'],
          equals: outbox.id,
        },
      },
    });

    expect(eventCount).toBe(1);
  });
});
