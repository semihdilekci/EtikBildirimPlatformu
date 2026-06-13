import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  TaskEventType,
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

describe('Task delegation integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let taskService: TaskService;
  let companyId: string;
  let secretaryUser: AuthenticatedUser;
  let delegateTargetUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    caseService = createCaseServiceForTests(prismaService);
    taskService = createTaskServiceForTests(prismaService);

    const secretary = await environment.prisma.user.create({
      data: {
        email: 'task-delegate-secretary@ethics.local',
        displayName: 'Task Delegate Secretary',
        oidcSubjectId: 'task-delegate-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: secretary.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: secretary.id,
        reason: 'Task delegation integration test',
      },
    });

    secretaryUser = {
      id: secretary.id,
      email: secretary.email,
      displayName: secretary.displayName,
      roles: [Role.COUNCIL_SECRETARY],
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };

    const delegateTarget = await environment.prisma.user.create({
      data: {
        email: 'task-delegate-target@ethics.local',
        displayName: 'Task Delegate Target',
        oidcSubjectId: 'task-delegate-target-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: delegateTarget.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: secretary.id,
        reason: 'Task delegation target',
      },
    });

    delegateTargetUser = {
      id: delegateTarget.id,
      email: delegateTarget.email,
      displayName: delegateTarget.displayName,
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

  async function createCaseWithReviewTask(): Promise<{ caseId: string; taskId: string }> {
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
        incidentDescription: 'Sentetik task delegation test bildirimi.',
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

    const reviewTask = await environment.prisma.task.findFirstOrThrow({
      where: {
        caseId: created.caseId,
        taskType: TaskType.SECRETARIAT_REVIEW_TASK,
      },
    });

    return { caseId: created.caseId, taskId: reviewTask.id };
  }

  it('delegate → orijinal DELEGATED, yeni PENDING task oluşur ve zincir korunur', async () => {
    const { caseId, taskId } = await createCaseWithReviewTask();

    const delegated = await taskService.delegateTask(
      secretaryUser,
      taskId,
      {
        delegateToUserId: delegateTargetUser.id,
        reason: 'İzin nedeniyle devrediyorum.',
      },
      randomUUID(),
    );

    expect(delegated.status).toBe(TaskStatus.PENDING);
    expect(delegated.assignedUserId).toBe(delegateTargetUser.id);
    expect(delegated.delegatedFromTaskId).toBe(taskId);
    expect(delegated.dueAt).not.toBeNull();

    const tasks = await environment.prisma.task.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.id).toBe(taskId);
    expect(tasks[0]?.status).toBe(TaskStatus.DELEGATED);
    expect(tasks[1]?.id).toBe(delegated.id);
    expect(tasks[1]?.status).toBe(TaskStatus.PENDING);
    expect(tasks[1]?.delegatedFromTaskId).toBe(taskId);
    expect(tasks[1]?.createdByTransitionId).toBe(tasks[0]?.createdByTransitionId);

    const originalEvents = await environment.prisma.taskEvent.findMany({
      where: { taskId },
      orderBy: { occurredAt: 'asc' },
    });
    expect(originalEvents.map((event) => event.eventType)).toEqual([
      TaskEventType.CREATED,
      TaskEventType.DELEGATED,
    ]);

    const newEvents = await environment.prisma.taskEvent.findMany({
      where: { taskId: delegated.id },
    });
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0]?.eventType).toBe(TaskEventType.CREATED);

    const auditOutbox = await environment.prisma.auditOutbox.findFirst({
      where: {
        eventType: 'TASK_DELEGATED',
        resourceId: delegated.id,
      },
    });
    expect(auditOutbox).not.toBeNull();
  });

  it('yetkisiz delegate → 403 AUTHZ_FORBIDDEN', async () => {
    const { caseId } = await createCaseWithReviewTask();

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
      taskService.delegateTask(
        secretaryUser,
        chairTask.id,
        {
          delegateToUserId: delegateTargetUser.id,
          reason: 'Yetkisiz devir denemesi.',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('negatif: kendine devir → TASK_DELEGATION_NOT_ALLOWED', async () => {
    const { taskId } = await createCaseWithReviewTask();

    await expect(
      taskService.delegateTask(
        secretaryUser,
        taskId,
        {
          delegateToUserId: secretaryUser.id,
          reason: 'Kendime devir.',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_DELEGATION_NOT_ALLOWED });
  });

  it('negatif: geçersiz devir hedefi → TASK_DELEGATION_INVALID_TARGET', async () => {
    const { taskId } = await createCaseWithReviewTask();

    await expect(
      taskService.delegateTask(
        secretaryUser,
        taskId,
        {
          delegateToUserId: randomUUID(),
          reason: 'Geçersiz hedef.',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_DELEGATION_INVALID_TARGET });
  });

  it('negatif: iptal edilmiş görev devredilemez → TASK_INVALID_STATE', async () => {
    const { taskId } = await createCaseWithReviewTask();

    await environment.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED },
    });

    await expect(
      taskService.delegateTask(
        secretaryUser,
        taskId,
        {
          delegateToUserId: delegateTargetUser.id,
          reason: 'İptal edilmiş görev.',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_INVALID_STATE });
  });

  it('user-specific task: atanmayan kullanıcı delegate → 404', async () => {
    const caseId = (await createCaseWithReviewTask()).caseId;

    const transition = await environment.prisma.caseTransition.create({
      data: {
        caseId,
        fromState: CaseState.RAPPORTEUR_ASSIGNED,
        toState: CaseState.RAPPORTEUR_ASSIGNED,
        command: WorkflowCommand.ASSIGN_RAPPORTEUR,
        actorType: AuditActorType.USER,
        performedByUserId: secretaryUser.id,
        idempotencyKey: randomUUID(),
      },
    });

    const rapporteurTask = await environment.prisma.task.create({
      data: {
        caseId,
        taskType: TaskType.RAPPORTEUR_REPORT_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.RAPPORTEUR,
        assignedUserId: delegateTargetUser.id,
        createdByTransitionId: transition.id,
      },
    });

    await expect(
      taskService.delegateTask(
        secretaryUser,
        rapporteurTask.id,
        {
          delegateToUserId: secretaryUser.id,
          reason: 'Başkasının görevine müdahale.',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_NOT_FOUND });
  });
});
