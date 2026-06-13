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

describe('Task lifecycle integration (Testcontainers)', () => {
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
        email: 'task-lifecycle-secretary@ethics.local',
        displayName: 'Task Lifecycle Secretary',
        oidcSubjectId: 'task-lifecycle-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'Task lifecycle integration test',
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

  async function createCase(): Promise<string> {
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
        incidentDescription: 'Sentetik task lifecycle test bildirimi.',
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

    return created.caseId;
  }

  it('transition → PENDING task oluşturur', async () => {
    const caseId = await createCase();

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const tasks = await environment.prisma.task.findMany({
      where: { caseId },
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.taskType).toBe(TaskType.SECRETARIAT_REVIEW_TASK);
    expect(tasks[0]?.status).toBe(TaskStatus.PENDING);
    expect(tasks[0]?.assignedRole).toBe(Role.COUNCIL_SECRETARY);
    expect(tasks[0]?.dueAt).not.toBeNull();
    expect(tasks[0]?.slaPolicyId).not.toBeNull();
  });

  it('complete → case state ilerler ve yeni task oluşur', async () => {
    const caseId = await createCase();

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const reviewTask = await environment.prisma.task.findFirstOrThrow({
      where: {
        caseId,
        taskType: TaskType.SECRETARIAT_REVIEW_TASK,
      },
    });

    const completed = await taskService.completeTask(
      secretaryUser,
      reviewTask.id,
      {
        outcome: 'Ön değerlendirme tamamlandı.',
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    expect(completed.status).toBe(TaskStatus.COMPLETED);
    expect(completed.case.currentState).toBe(CaseState.PRE_RESEARCH);

    const caseRecord = await environment.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
    });
    expect(caseRecord.currentState).toBe(CaseState.PRE_RESEARCH);

    const tasks = await environment.prisma.task.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.status).toBe(TaskStatus.COMPLETED);
    expect(tasks[1]?.taskType).toBe(TaskType.PRE_RESEARCH_TASK);
    expect(tasks[1]?.status).toBe(TaskStatus.PENDING);
  });

  it('member_approval_task complete reddedilir', async () => {
    const caseId = await createCase();

    const transition = await environment.prisma.caseTransition.create({
      data: {
        caseId,
        fromState: CaseState.AGENDA_READY,
        toState: CaseState.MEMBER_APPROVAL,
        command: WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL,
        actorType: AuditActorType.USER,
        performedByUserId: secretaryUser.id,
        idempotencyKey: randomUUID(),
      },
    });

    await environment.prisma.case.update({
      where: { id: caseId },
      data: { currentState: CaseState.MEMBER_APPROVAL },
    });

    const memberTask = await environment.prisma.task.create({
      data: {
        caseId,
        taskType: TaskType.MEMBER_APPROVAL_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.COUNCIL_MEMBER,
        createdByTransitionId: transition.id,
      },
    });

    await expect(
      taskService.completeTask(
        secretaryUser,
        memberTask.id,
        {
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TASK_COMPLETION_NOT_ALLOWED });
  });
});
