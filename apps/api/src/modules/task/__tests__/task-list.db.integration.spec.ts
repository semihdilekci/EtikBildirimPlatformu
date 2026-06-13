import { randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  ErrorCode,
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

describe('Task list/detail integration (Testcontainers)', () => {
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
        email: 'task-list-secretary@ethics.local',
        displayName: 'Task List Secretary',
        oidcSubjectId: 'task-list-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'Task list integration test',
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

  async function seedCaseWithReviewTask(): Promise<{ caseId: string; taskId: string }> {
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
        incidentDescription: 'Task list integration test bildirimi.',
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

    const task = await environment.prisma.task.findFirstOrThrow({
      where: { caseId: created.caseId, taskType: TaskType.SECRETARIAT_REVIEW_TASK },
    });

    return { caseId: created.caseId, taskId: task.id };
  }

  it('listTasks status filtresi ile görev döner', async () => {
    const { caseId, taskId } = await seedCaseWithReviewTask();

    const result = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.PENDING],
      limit: 20,
      sortBy: 'dueAt',
      sortOrder: 'asc',
    });

    expect(result.data.some((task) => task.id === taskId)).toBe(true);
    expect(result.data.every((task) => task.status === TaskStatus.PENDING)).toBe(true);
    expect(result.pagination.total).toBeNull();
    expect(result.data.find((task) => task.id === taskId)?.caseId).toBe(caseId);
  });

  it('getTaskDetail görev detayını döner', async () => {
    const { caseId, taskId } = await seedCaseWithReviewTask();

    const detail = await taskService.getTaskDetail(secretaryUser, taskId);

    expect(detail.id).toBe(taskId);
    expect(detail.caseId).toBe(caseId);
    expect(detail.taskType).toBe(TaskType.SECRETARIAT_REVIEW_TASK);
    expect(detail.case.companyName.length).toBeGreaterThan(0);
  });

  it('negatif: geçersiz cursor → VALIDATION_FAILED', async () => {
    await expect(
      taskService.listTasks(secretaryUser, {
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        cursor: 'invalid-cursor',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('negatif: bulunamayan görev → TASK_NOT_FOUND', async () => {
    await expect(taskService.getTaskDetail(secretaryUser, randomUUID())).rejects.toMatchObject({
      code: ErrorCode.TASK_NOT_FOUND,
    });
  });

  it('negatif: zaten tamamlanmış görev → TASK_ALREADY_COMPLETED', async () => {
    const { taskId } = await seedCaseWithReviewTask();

    await taskService.completeTask(
      secretaryUser,
      taskId,
      { idempotencyKey: randomUUID() },
      randomUUID(),
    );

    await expect(
      taskService.completeTask(
        secretaryUser,
        taskId,
        { idempotencyKey: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_ALREADY_COMPLETED });
  });

  it('negatif: geçersiz status filtresi → VALIDATION_FAILED', async () => {
    await expect(
      taskService.listTasks(secretaryUser, {
        status: ['INVALID_STATUS'],
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('negatif: yetkisiz kullanıcı complete → TASK_NOT_FOUND', async () => {
    const { taskId } = await seedCaseWithReviewTask();

    const outsider = await environment.prisma.user.create({
      data: {
        email: 'task-list-outsider@ethics.local',
        displayName: 'Outsider',
        oidcSubjectId: 'task-list-outsider-oidc',
        clearanceLevel: ClearanceLevel.NORMAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: outsider.id,
        roleCode: Role.RAPPORTEUR,
        assignedBy: secretaryUser.id,
        reason: 'Task list deny test',
      },
    });

    const outsiderUser: AuthenticatedUser = {
      id: outsider.id,
      email: outsider.email,
      displayName: outsider.displayName,
      roles: [Role.RAPPORTEUR],
      clearanceLevel: ClearanceLevel.NORMAL,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };

    await expect(
      taskService.completeTask(
        outsiderUser,
        taskId,
        { idempotencyKey: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_NOT_FOUND });
  });

  it('negatif: rol uyuşmazlığı complete → AUTHZ_FORBIDDEN', async () => {
    const { caseId } = await seedCaseWithReviewTask();

    const transition = await environment.prisma.caseTransition.findFirstOrThrow({
      where: { caseId },
    });

    const chairTask = await environment.prisma.task.create({
      data: {
        caseId,
        taskType: TaskType.CHAIR_GATE_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.COUNCIL_CHAIR,
        createdByTransitionId: transition.id,
      },
    });

    await expect(
      taskService.completeTask(
        secretaryUser,
        chairTask.id,
        { idempotencyKey: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('listTasks taskType ve dueBefore filtrelerini uygular', async () => {
    const { caseId, taskId } = await seedCaseWithReviewTask();

    const result = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.PENDING],
      taskType: TaskType.SECRETARIAT_REVIEW_TASK,
      caseId,
      dueBefore: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      limit: 20,
      sortBy: 'dueAt',
      sortOrder: 'asc',
    });

    expect(result.data.some((task) => task.id === taskId)).toBe(true);
  });

  it('negatif: iptal edilmiş görev tamamlanamaz → TASK_INVALID_STATE', async () => {
    const { taskId } = await seedCaseWithReviewTask();

    await environment.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED },
    });

    await expect(
      taskService.completeTask(
        secretaryUser,
        taskId,
        { idempotencyKey: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_INVALID_STATE });
  });

  it('complete idempotencyKey tekrarında tamamlanmış görevi döner', async () => {
    const { taskId } = await seedCaseWithReviewTask();
    const idempotencyKey = randomUUID();

    await taskService.completeTask(secretaryUser, taskId, { idempotencyKey }, randomUUID());

    const second = await taskService.completeTask(
      secretaryUser,
      taskId,
      { idempotencyKey },
      randomUUID(),
    );

    expect(second.status).toBe(TaskStatus.COMPLETED);
  });

  it('listTasks cursor pagination hasMore döner', async () => {
    await seedCaseWithReviewTask();
    await seedCaseWithReviewTask();

    const firstPage = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.PENDING],
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.pagination.hasMore).toBe(true);
    expect(firstPage.pagination.nextCursor).not.toBeNull();

    const secondPage = await taskService.listTasks(secretaryUser, {
      status: [TaskStatus.PENDING],
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'asc',
      cursor: firstPage.pagination.nextCursor ?? undefined,
    });

    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0]?.id);
  });
});
