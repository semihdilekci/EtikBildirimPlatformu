import { randomUUID } from 'node:crypto';

import {
  NotificationTemplateCode,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
} from '@ethics/shared';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RetentionPurgeJob } from '../retention-purge.job.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';

describe('RetentionPurgeJob integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let userId: string;
  let companyId: string;
  let purgeableNotificationId: string;
  let legalHoldNotificationId: string;

  const fixedNow = new Date('2026-06-01T08:00:00.000Z');
  const staleCreatedAt = new Date('2025-01-01T08:00:00.000Z');

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const user = await environment.prisma.user.create({
      data: {
        email: 'retention-purge-user@ethics.local',
        displayName: 'Retention Purge User',
        oidcSubjectId: 'retention-purge-user-oidc',
        clearanceLevel: 'STRICTLY_CONFIDENTIAL',
        provisionedAt: new Date(),
      },
    });
    userId = user.id;

    async function createReport() {
      const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      return environment.prisma.report.create({
        data: {
          trackingCode: `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`,
          trackingCodePasswordHash:
            '$argon2id$v=19$m=65536,t=3,p=1$dGVzdA$placeholder-hash-for-integration-test',
          isAnonymous: true,
          incidentCountry: 'TUR',
          incidentCity: 'Ankara',
          companyId,
          categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
          categories: [ReportSubCategory.WORKPLACE_VIOLENCE],
          incidentDescription: 'Retention purge test.',
          encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
          status: ReportStatus.SUBMITTED,
          confidentialityLevel: 'SENSITIVE',
          channel: ReportChannel.WEB_FORM,
          kvkkConsentVersion: '1.0',
          kvkkConsentAt: new Date(),
          submittedAt: new Date(),
        },
      });
    }

    const normalCase = await environment.prisma.case.create({
      data: {
        reportId: (await createReport()).id,
        currentState: 'closed',
        workflowVersion: '1.0.0',
        companyId,
        createdBy: userId,
        legalHoldFlag: false,
      },
    });

    const heldCase = await environment.prisma.case.create({
      data: {
        reportId: (await createReport()).id,
        currentState: 'closed',
        workflowVersion: '1.0.0',
        companyId,
        createdBy: userId,
        legalHoldFlag: true,
      },
    });

    const purgeable = await environment.prisma.notification.create({
      data: {
        userId,
        templateCode: NotificationTemplateCode.SLA_WARNING,
        title: 'Eski bildirim',
        body: 'Retention purge test',
        caseId: normalCase.id,
        isRead: true,
        readAt: staleCreatedAt,
        createdAt: staleCreatedAt,
      },
    });
    purgeableNotificationId = purgeable.id;

    const held = await environment.prisma.notification.create({
      data: {
        userId,
        templateCode: NotificationTemplateCode.SLA_WARNING,
        title: 'Legal hold bildirimi',
        body: 'Legal hold skip test',
        caseId: heldCase.id,
        isRead: true,
        readAt: staleCreatedAt,
        createdAt: staleCreatedAt,
      },
    });
    legalHoldNotificationId = held.id;
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('retention süresi dolan okunmuş bildirimleri siler; legal_hold vakasına bağlı olanları atlar', async () => {
    const job = new RetentionPurgeJob(environment.prisma, 90, 24 * 60 * 60 * 1000, {
      now: () => fixedNow,
    });

    const result = await job.run();

    expect(result.candidatesScanned).toBe(2);
    expect(result.purgedCount).toBe(1);
    expect(result.skippedLegalHoldCount).toBe(1);

    const purgeableExists = await environment.prisma.notification.findUnique({
      where: { id: purgeableNotificationId },
    });
    const heldExists = await environment.prisma.notification.findUnique({
      where: { id: legalHoldNotificationId },
    });

    expect(purgeableExists).toBeNull();
    expect(heldExists).not.toBeNull();
  });

  it('cron periyodu dolmadan runIfDue tekrar çalışmaz', async () => {
    const job = new RetentionPurgeJob(environment.prisma, 90, 60_000, {
      now: () => fixedNow,
    });

    const first = await job.runIfDue(1_000);
    const second = await job.runIfDue(30_000);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});
