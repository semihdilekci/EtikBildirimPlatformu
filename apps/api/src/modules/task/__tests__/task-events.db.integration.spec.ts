import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  ClearanceLevel,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  TaskEventType,
  TaskStatus,
  TaskType,
} from '@ethics/shared';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { createCaseServiceForTests } from '../../case-management/__tests__/case-service.test-factory.js';

describe('task_events DB triggers (append-only)', () => {
  let environment: PostgresTestEnvironment;
  let companyId: string;
  let taskId: string;
  let eventId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    const caseService = createCaseServiceForTests(prismaService);

    const user = await environment.prisma.user.create({
      data: {
        email: 'task-events-append@ethics.local',
        displayName: 'Task Events Append Test',
        oidcSubjectId: 'task-events-append-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'Task events append-only test',
      },
    });

    const secretaryUser: AuthenticatedUser = {
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

    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    const report = await environment.prisma.report.create({
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
        incidentDescription: 'Sentetik task events append-only test.',
        encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
        status: ReportStatus.SUBMITTED,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        channel: ReportChannel.WEB_FORM,
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    const created = await caseService.createCaseFromReport(
      secretaryUser,
      {
        reportId: report.id,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    const transition = await environment.prisma.caseTransition.create({
      data: {
        caseId: created.caseId,
        fromState: 'report_submitted',
        toState: 'secretariat_review',
        command: 'acknowledge_report',
        actorType: AuditActorType.USER,
        performedByUserId: user.id,
        idempotencyKey: randomUUID(),
      },
    });

    const task = await environment.prisma.task.create({
      data: {
        caseId: created.caseId,
        taskType: TaskType.SECRETARIAT_REVIEW_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.COUNCIL_SECRETARY,
        createdByTransitionId: transition.id,
      },
    });
    taskId = task.id;

    const event = await environment.prisma.taskEvent.create({
      data: {
        taskId,
        eventType: TaskEventType.CREATED,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
      },
    });
    eventId = event.id;
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('append-only: UPDATE task_events DB hatası verir', async () => {
    await expect(
      environment.prisma.$executeRawUnsafe(
        `UPDATE task_events SET event_type = 'COMPLETED' WHERE id = $1`,
        eventId,
      ),
    ).rejects.toThrow(/TASK_EVENT_APPEND_ONLY_VIOLATION/);
  });

  it('append-only: DELETE task_events DB hatası verir', async () => {
    await expect(
      environment.prisma.$executeRawUnsafe(`DELETE FROM task_events WHERE id = $1`, eventId),
    ).rejects.toThrow(/TASK_EVENT_APPEND_ONLY_VIOLATION/);
  });

  it('append-only: TRUNCATE task_events DB hatası verir', async () => {
    await expect(environment.prisma.$executeRawUnsafe('TRUNCATE task_events')).rejects.toThrow(
      /TASK_EVENT_APPEND_ONLY_VIOLATION/,
    );
  });
});
