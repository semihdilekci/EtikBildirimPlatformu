import { randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  NotificationChannel,
  NotificationEventType,
  NotificationTemplateCode,
  Role,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotificationDispatcherJob } from '../notification-dispatcher.job.js';
import { InMemoryEmailRelayAdapter } from '../../email/in-memory-email-relay.adapter.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';

describe('NotificationDispatcherJob integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let dispatchJob: NotificationDispatcherJob;
  let emailRelay: InMemoryEmailRelayAdapter;
  let recipientUserId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    emailRelay = new InMemoryEmailRelayAdapter();
    dispatchJob = new NotificationDispatcherJob(environment.prisma, { emailRelay });

    const user = await environment.prisma.user.create({
      data: {
        email: 'dispatcher-recipient@ethics.local',
        displayName: 'Dispatcher Recipient',
        oidcSubjectId: 'dispatcher-recipient-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'Notification dispatcher integration test',
      },
    });

    recipientUserId = user.id;
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function seedPendingEvent(
    suffix: string,
    overrides: {
      idempotencyKey?: string;
      recipientUserId?: string | null;
      recipientTrackingCode?: string | null;
      eventType?: string;
      channel?: (typeof NotificationChannel)[keyof typeof NotificationChannel];
      metadataJson?: Prisma.InputJsonValue;
    } = {},
  ) {
    return environment.prisma.notificationEvent.create({
      data: {
        eventType: overrides.eventType ?? NotificationEventType.CASE_TRANSITION,
        channel: overrides.channel ?? NotificationChannel.IN_APP,
        recipientUserId:
          overrides.recipientUserId === undefined ? recipientUserId : overrides.recipientUserId,
        recipientTrackingCode: overrides.recipientTrackingCode ?? null,
        caseId: randomUUID(),
        correlationId: `corr-${suffix}`,
        idempotencyKey: overrides.idempotencyKey,
        metadataJson: overrides.metadataJson ?? { transitionId: `transition-${suffix}` },
        dispatchStatus: 'PENDING',
      },
    });
  }

  it('PENDING IN_APP outbox → dispatch → notifications kaydı + SENT', async () => {
    const suffix = randomUUID();
    const outbox = await seedPendingEvent(suffix, {
      idempotencyKey: `worker-dispatch-${suffix}`,
    });

    const result = await dispatchJob.processPendingBatch();

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(result.items.some((item) => item.eventId === outbox.id && item.status === 'sent')).toBe(
      true,
    );

    const updatedOutbox = await environment.prisma.notificationEvent.findUnique({
      where: { id: outbox.id },
    });
    expect(updatedOutbox?.dispatchStatus).toBe('SENT');
    expect(updatedOutbox?.sentAt).not.toBeNull();

    const notification = await environment.prisma.notification.findFirst({
      where: {
        userId: recipientUserId,
        templateCode: NotificationTemplateCode.CASE_TRANSITION,
        caseId: outbox.caseId,
      },
    });

    expect(notification).toMatchObject({
      templateCode: NotificationTemplateCode.CASE_TRANSITION,
      isRead: false,
    });
    expect(notification?.body).not.toMatch(/report_text|incident_description/i);
  });

  it('PENDING EMAIL outbox → dispatch → içeriksiz e-posta gönderilir', async () => {
    emailRelay.clear();
    const suffix = randomUUID();
    const outbox = await seedPendingEvent(suffix, {
      channel: NotificationChannel.EMAIL,
      idempotencyKey: `worker-email-${suffix}`,
      metadataJson: {
        transitionId: `transition-${suffix}`,
        report_text: 'bu metadata e-postada görünmemeli',
        incident_description: 'gizli olay detayı',
      },
    });

    const result = await dispatchJob.processPendingBatch();

    expect(result.items.some((item) => item.eventId === outbox.id && item.status === 'sent')).toBe(
      true,
    );

    expect(emailRelay.sent).toHaveLength(1);
    const email = emailRelay.sent[0];
    expect(email?.to).toBe('dispatcher-recipient@ethics.local');
    expect(email?.textBody).toMatch(/platforma giriş yapınız/i);
    expect(email?.textBody).not.toMatch(/report_text|incident_description/i);
    expect(email?.htmlBody).not.toMatch(/report_text|incident_description/i);

    const updatedOutbox = await environment.prisma.notificationEvent.findUnique({
      where: { id: outbox.id },
    });
    expect(updatedOutbox?.dispatchStatus).toBe('SENT');
    const metadataJson = updatedOutbox?.metadataJson as { emailMessageId?: unknown } | null;
    expect(typeof metadataJson?.emailMessageId).toBe('string');
  });

  it('anonim tracking alıcısı için EMAIL dispatch → NOTIFICATION_EMAIL_NOT_ALLOWED', async () => {
    emailRelay.clear();
    const suffix = randomUUID();
    const outbox = await seedPendingEvent(suffix, {
      channel: NotificationChannel.EMAIL,
      recipientUserId: null,
      recipientTrackingCode: 'TRK-ANON-001',
      idempotencyKey: `worker-email-anon-${suffix}`,
    });

    const result = await dispatchJob.processPendingBatch();

    expect(
      result.items.some((item) => item.eventId === outbox.id && item.status === 'failed'),
    ).toBe(true);

    const updatedOutbox = await environment.prisma.notificationEvent.findUnique({
      where: { id: outbox.id },
    });
    expect(updatedOutbox?.errorCode).toBe('NOTIFICATION_EMAIL_NOT_ALLOWED');
    expect(emailRelay.sent).toHaveLength(0);
  });

  it('aynı outbox ikinci dispatch denemesinde çift notification oluşturmaz', async () => {
    const suffix = randomUUID();
    const outbox = await seedPendingEvent(suffix, {
      idempotencyKey: `worker-idem-${suffix}`,
    });

    await dispatchJob.processPendingBatch();
    await dispatchJob.processPendingBatch();

    const notificationCount = await environment.prisma.notification.count({
      where: {
        userId: recipientUserId,
        templateCode: NotificationTemplateCode.CASE_TRANSITION,
        caseId: outbox.caseId,
      },
    });

    expect(notificationCount).toBe(1);
  });

  it('recipient eksik → FAILED + notification oluşturulmaz', async () => {
    const suffix = randomUUID();
    const outbox = await seedPendingEvent(suffix, {
      recipientUserId: null,
      idempotencyKey: `worker-no-recipient-${suffix}`,
    });

    const result = await dispatchJob.processPendingBatch();

    expect(
      result.items.some((item) => item.eventId === outbox.id && item.status === 'failed'),
    ).toBe(true);

    const updatedOutbox = await environment.prisma.notificationEvent.findUnique({
      where: { id: outbox.id },
    });
    expect(updatedOutbox?.dispatchStatus).toBe('FAILED');
    expect(updatedOutbox?.errorCode).toBe('NOTIFICATION_MISSING_RECIPIENT');

    const notificationCount = await environment.prisma.notification.count({
      where: { caseId: outbox.caseId },
    });
    expect(notificationCount).toBe(0);
  });

  it('max retry sonrası PERMANENTLY_FAILED dead-letter', async () => {
    const suffix = randomUUID();
    const outbox = await seedPendingEvent(suffix, {
      recipientUserId: null,
      idempotencyKey: `worker-dead-letter-${suffix}`,
    });

    const failingJob = new NotificationDispatcherJob(environment.prisma, { maxRetryCount: 1 });
    await failingJob.processPendingBatch();

    const updatedOutbox = await environment.prisma.notificationEvent.findUnique({
      where: { id: outbox.id },
    });

    expect(updatedOutbox?.dispatchStatus).toBe('PERMANENTLY_FAILED');
    expect(updatedOutbox?.retryCount).toBe(1);
  });
});
