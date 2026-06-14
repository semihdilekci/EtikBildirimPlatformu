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
  TaskStatus,
  TaskType,
  WORKFLOW_VERSION,
} from '@ethics/shared';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotificationService } from '../../../../notification/notification.service.js';
import { NotificationEventPublisher } from '../../../../notification/notification-event.publisher.js';
import { PrismaService } from '../../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../../test/postgres-test-environment.js';
import { SlaReminderHandler } from '../sla-reminder.handler.js';

describe('SlaReminderHandler DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let handler: SlaReminderHandler;
  let assigneeUserId: string;
  let companyId: string;
  let caseId: string;
  let transitionId: string;

  const fixedNow = new Date('2025-06-09T08:00:00.000Z');

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const user = await environment.prisma.user.create({
      data: {
        email: 'sla-reminder-assignee@ethics.local',
        displayName: 'SLA Reminder Assignee',
        oidcSubjectId: 'sla-reminder-assignee-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'SLA reminder integration test',
      },
    });

    assigneeUserId = user.id;

    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    const seeded = await environment.prisma.$transaction(async (tx) => {
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
          incidentDescription: 'SLA reminder test.',
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
          currentState: CaseState.PRE_RESEARCH,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          companyId,
          createdBy: assigneeUserId,
        },
      });

      const transition = await tx.caseTransition.create({
        data: {
          caseId: createdCase.id,
          fromState: 'intake',
          toState: 'pre_research',
          command: 'START_PRE_RESEARCH',
          actorType: 'USER',
          performedByUserId: assigneeUserId,
          idempotencyKey: `sla-reminder-transition-${randomUUID()}`,
        },
      });

      return { caseId: createdCase.id, transitionId: transition.id };
    });

    caseId = seeded.caseId;
    transitionId = seeded.transitionId;

    const prismaService = environment.prisma as unknown as PrismaService;
    const notificationService = new NotificationService(new NotificationEventPublisher());
    handler = new SlaReminderHandler(prismaService, notificationService, {
      now: () => fixedNow,
    });
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('SLA penceresinde kalan ≤%20 iken SLA_WARNING notification event üretir', async () => {
    const createdAt = new Date('2025-06-01T08:00:00.000Z');
    const dueAt = new Date('2025-06-11T08:00:00.000Z');

    const task = await environment.prisma.task.create({
      data: {
        caseId,
        taskType: TaskType.PRE_RESEARCH_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.COUNCIL_SECRETARY,
        assignedUserId: assigneeUserId,
        dueAt,
        createdAt,
        createdByTransitionId: transitionId,
      },
    });

    const result = await handler.processPendingBatch();

    expect(result.tasksScanned).toBeGreaterThanOrEqual(1);
    expect(result.warningsCreated).toBe(1);
    expect(result.breachesCreated).toBe(0);

    const warningEvents = await environment.prisma.notificationEvent.findMany({
      where: {
        eventType: NotificationEventType.SLA_WARNING,
        caseId,
      },
    });

    expect(warningEvents.length).toBeGreaterThanOrEqual(2);
    expect(warningEvents.some((event) => event.channel === NotificationChannel.IN_APP)).toBe(true);
    expect(warningEvents.some((event) => event.channel === NotificationChannel.EMAIL)).toBe(true);
    expect(
      warningEvents.every((event) => {
        const metadata = event.metadataJson as { taskId?: string } | null;
        return metadata?.taskId === task.id;
      }),
    ).toBe(true);

    const duplicateRun = await handler.processPendingBatch();
    expect(duplicateRun.warningsCreated).toBe(0);
  });

  it('SLA aşıldığında SLA_BREACH notification event üretir', async () => {
    const overdueCreatedAt = new Date('2025-05-01T08:00:00.000Z');
    const overdueDueAt = new Date('2025-06-01T08:00:00.000Z');

    await environment.prisma.task.create({
      data: {
        caseId,
        taskType: TaskType.PRE_RESEARCH_TASK,
        status: TaskStatus.IN_PROGRESS,
        assignedRole: Role.COUNCIL_SECRETARY,
        assignedUserId: assigneeUserId,
        dueAt: overdueDueAt,
        createdAt: overdueCreatedAt,
        createdByTransitionId: transitionId,
      },
    });

    const result = await handler.processPendingBatch();

    expect(result.breachesCreated).toBeGreaterThanOrEqual(1);

    const breachEvents = await environment.prisma.notificationEvent.findMany({
      where: {
        eventType: NotificationEventType.SLA_BREACH,
        caseId,
      },
    });

    expect(breachEvents.length).toBeGreaterThanOrEqual(2);
  });
});
