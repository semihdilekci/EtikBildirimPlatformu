import { randomUUID } from 'node:crypto';

import {
  CaseState,
  ClearanceLevel,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  TaskStatus,
  TaskType,
  WorkflowCommand,
} from '@ethics/shared';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import {
  createCaseServiceForTests,
  createTaskServiceForTests,
} from '../../case-management/__tests__/case-service.test-factory.js';
import type { CaseService } from '../../case-management/case.service.js';
import type { TaskService } from '../task.service.js';

/**
 * E2E journey: transition side-effect → görev listede görünür → tamamlama → vaka ilerler.
 * Docs/10 Faz 6 Session 6.6 — task complete → case transition otomatik tetiklenir.
 */
describe('Task SLA journey E2E (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let taskService: TaskService;
  let companyId: string;
  let secretaryUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    caseService = createCaseServiceForTests(prismaService);
    taskService = createTaskServiceForTests(prismaService);

    const user = await environment.prisma.user.create({
      data: {
        email: 'task-journey-secretary@ethics.local',
        displayName: 'Task Journey Secretary',
        oidcSubjectId: 'task-journey-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'Task journey E2E test',
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

  it('transition → listede görünür → complete → case state ilerler', async () => {
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
        incidentDescription: 'Task journey E2E sentetik bildirim.',
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
      { reportId: report.id, idempotencyKey: randomUUID() },
      randomUUID(),
    );

    await caseService.executeTransition(
      secretaryUser,
      created.caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const pendingList = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.PENDING],
      caseId: created.caseId,
      limit: 20,
      sortBy: 'dueAt',
      sortOrder: 'asc',
    });

    expect(pendingList.data).toHaveLength(1);
    expect(pendingList.data[0]?.taskType).toBe(TaskType.SECRETARIAT_REVIEW_TASK);
    expect(pendingList.data[0]?.dueAt).not.toBeNull();
    expect(pendingList.data[0]?.slaStatus).not.toBeNull();

    const reviewTaskId = pendingList.data[0]?.id;
    expect(reviewTaskId).toBeDefined();
    if (!reviewTaskId) {
      throw new Error('reviewTaskId expected');
    }

    const detailBefore = await taskService.getTaskDetail(secretaryUser, reviewTaskId);
    expect(detailBefore.status).toBe(TaskStatus.PENDING);
    expect(detailBefore.case.currentState).toBe(CaseState.SECRETARIAT_REVIEW);

    const completed = await taskService.completeTask(
      secretaryUser,
      reviewTaskId,
      {
        outcome: 'Journey E2E tamamlandı.',
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    expect(completed.status).toBe(TaskStatus.COMPLETED);
    expect(completed.case.currentState).toBe(CaseState.PRE_RESEARCH);

    const caseRecord = await environment.prisma.case.findUniqueOrThrow({
      where: { id: created.caseId },
    });
    expect(caseRecord.currentState).toBe(CaseState.PRE_RESEARCH);

    const completedList = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.COMPLETED],
      caseId: created.caseId,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(completedList.data.some((task) => task.id === reviewTaskId)).toBe(true);

    const nextPending = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.PENDING],
      caseId: created.caseId,
      limit: 20,
      sortBy: 'dueAt',
      sortOrder: 'asc',
    });
    expect(nextPending.data.some((task) => task.taskType === TaskType.PRE_RESEARCH_TASK)).toBe(
      true,
    );
  });
});
