import { randomUUID } from 'node:crypto';

import {
  CaseState,
  ClearanceLevel,
  NotificationChannel,
  NotificationEventType,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  WorkflowCommand,
  WORKFLOW_VERSION,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';
import { CaseService } from '../../modules/case-management/case.service.js';
import { createCaseServiceForTests } from '../../modules/case-management/__tests__/case-service.test-factory.js';

describe('Notification event triggers DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let secretaryUser: AuthenticatedUser;
  let companyId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    caseService = createCaseServiceForTests(prismaService);

    const user = await environment.prisma.user.create({
      data: {
        email: 'notification-trigger-secretary@ethics.local',
        displayName: 'Notification Trigger Secretary',
        oidcSubjectId: 'notification-trigger-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'Notification trigger integration test',
      },
    });

    secretaryUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [Role.COUNCIL_SECRETARY],
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function createCaseAtState(currentState: string, createdBy: string): Promise<string> {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    return environment.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const report = await tx.report.create({
        data: {
          trackingCode,
          trackingCodePasswordHash:
            '$argon2id$v=19$m=65536,t=3,p=1$dGVzdA$placeholder-hash-for-integration-test',
          isAnonymous: true,
          incidentCountry: 'TUR',
          incidentCity: 'Ankara',
          companyId,
          categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
          categories: [ReportSubCategory.WORKPLACE_VIOLENCE],
          incidentDescription: 'Notification trigger test bildirimi.',
          encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
          status: ReportStatus.SUBMITTED,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          channel: ReportChannel.WEB_FORM,
          kvkkConsentVersion: '1.0',
          kvkkConsentAt: new Date(),
          submittedAt: new Date(),
        },
      });

      const createdCase = await tx.case.create({
        data: {
          reportId: report.id,
          currentState,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          companyId,
          createdBy,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });
  }

  it('case transition → IN_APP + EMAIL outbox kayıtları alıcı ile oluşur', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);
    const idempotencyKey = randomUUID();
    const correlationId = randomUUID();

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey,
        metadata: {},
      },
      correlationId,
    );

    const inAppOutbox = await environment.prisma.notificationEvent.findMany({
      where: {
        caseId,
        correlationId,
        eventType: NotificationEventType.CASE_TRANSITION,
        channel: NotificationChannel.IN_APP,
      },
    });

    expect(inAppOutbox.length).toBeGreaterThan(0);
    expect(inAppOutbox.every((event) => event.recipientUserId !== null)).toBe(true);
    expect(inAppOutbox.every((event) => event.dispatchStatus === 'PENDING')).toBe(true);

    const emailOutbox = await environment.prisma.notificationEvent.findMany({
      where: {
        caseId,
        correlationId,
        eventType: NotificationEventType.CASE_TRANSITION,
        channel: NotificationChannel.EMAIL,
      },
    });

    expect(emailOutbox.length).toBe(inAppOutbox.length);
    expect(emailOutbox.every((event) => event.recipientUserId !== null)).toBe(true);

    const taskAssignedOutbox = await environment.prisma.notificationEvent.findFirst({
      where: {
        caseId,
        correlationId,
        eventType: NotificationEventType.TASK_ASSIGNED,
        channel: NotificationChannel.IN_APP,
      },
    });
    expect(taskAssignedOutbox).toBeTruthy();
    expect(taskAssignedOutbox?.metadataJson).toMatchObject({
      taskType: expect.any(String),
    });
  });

  it('fail-closed: domain transaction rollback → notification outbox kaydı da silinir', async () => {
    const caseId = await createCaseAtState(CaseState.SECRETARIAT_REVIEW, secretaryUser.id);
    const marker = randomUUID();

    await expect(
      environment.prisma.$transaction(async (tx) => {
        await tx.case.update({
          where: { id: caseId },
          data: { currentState: CaseState.PRE_RESEARCH, optimisticLockVersion: { increment: 1 } },
        });

        await tx.notificationEvent.create({
          data: {
            eventType: NotificationEventType.CASE_TRANSITION,
            channel: NotificationChannel.IN_APP,
            recipientUserId: secretaryUser.id,
            caseId,
            correlationId: marker,
            idempotencyKey: `rollback-test:${marker}`,
            dispatchStatus: 'PENDING',
          },
        });

        throw new Error('simulated domain failure');
      }),
    ).rejects.toThrow('simulated domain failure');

    const count = await environment.prisma.notificationEvent.count({
      where: { correlationId: marker },
    });
    expect(count).toBe(0);
  });
});
