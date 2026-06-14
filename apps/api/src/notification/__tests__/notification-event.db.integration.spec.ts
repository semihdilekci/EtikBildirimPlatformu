import {
  NotificationChannel,
  NotificationEventType,
  NOTIFICATION_DISPATCH_PENDING,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';
import { NotificationEventPublisher } from '../notification-event.publisher.js';

describe('Notification event outbox DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let publisher: NotificationEventPublisher;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    publisher = new NotificationEventPublisher();
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('domain transaction içinde publish → notification_events PENDING kaydı oluşur', async () => {
    const correlationId = crypto.randomUUID();
    const caseId = crypto.randomUUID();

    const outboxId = await environment.prisma.$transaction(async (tx) => {
      const record = await publisher.publish(tx, {
        eventType: NotificationEventType.CASE_TRANSITION,
        channel: NotificationChannel.IN_APP,
        recipientUserId: 'user-integration-1',
        caseId,
        correlationId,
        idempotencyKey: `idem-${correlationId}`,
        metadata: { fromState: 'PRE_REVIEW', toState: 'INVESTIGATION' },
      });

      return record.id;
    });

    const stored = await environment.prisma.notificationEvent.findUnique({
      where: { id: outboxId },
    });

    expect(stored).toMatchObject({
      eventType: NotificationEventType.CASE_TRANSITION,
      channel: NotificationChannel.IN_APP,
      dispatchStatus: NOTIFICATION_DISPATCH_PENDING,
      recipientUserId: 'user-integration-1',
      caseId,
      correlationId,
    });
    expect(stored?.metadataJson).toEqual({
      fromState: 'PRE_REVIEW',
      toState: 'INVESTIGATION',
    });
  });

  it('fail-closed: transaction rollback olunca notification_events kaydı da silinir', async () => {
    const marker = crypto.randomUUID();

    await expect(
      environment.prisma.$transaction(async (tx) => {
        await publisher.publish(tx, {
          eventType: NotificationEventType.CASE_TRANSITION,
          channel: NotificationChannel.IN_APP,
          recipientUserId: 'user-integration-2',
          correlationId: marker,
          idempotencyKey: `rollback-${marker}`,
        });

        throw new Error('simulated domain failure');
      }),
    ).rejects.toThrow('simulated domain failure');

    const count = await environment.prisma.notificationEvent.count({
      where: { correlationId: marker },
    });

    expect(count).toBe(0);
  });

  it('aynı idempotency_key ikinci publish mevcut kaydı döner, çift outbox oluşturmaz', async () => {
    const idempotencyKey = `dup-${crypto.randomUUID()}`;

    const firstId = await environment.prisma.$transaction(async (tx) => {
      const record = await publisher.publish(tx, {
        eventType: NotificationEventType.CASE_TRANSITION,
        channel: NotificationChannel.IN_APP,
        recipientUserId: 'user-integration-3',
        idempotencyKey,
      });

      return record.id;
    });

    const secondId = await environment.prisma.$transaction(async (tx) => {
      const record = await publisher.publish(tx, {
        eventType: NotificationEventType.CASE_TRANSITION,
        channel: NotificationChannel.IN_APP,
        recipientUserId: 'user-integration-3',
        idempotencyKey,
      });

      return record.id;
    });

    expect(secondId).toBe(firstId);

    const count = await environment.prisma.notificationEvent.count({
      where: { idempotencyKey },
    });
    expect(count).toBe(1);
  });
});
