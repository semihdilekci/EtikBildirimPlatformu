import { randomUUID } from 'node:crypto';

import {
  CaseState,
  ClearanceLevel,
  ErrorCode,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  WORKFLOW_VERSION,
  WorkflowCommand,
} from '@ethics/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { CaseService } from '../case.service.js';
import { createCaseServiceForTests } from './case-service.test-factory.js';

describe('Stage 1 transition matrix (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let companyId: string;
  let secretaryUser: AuthenticatedUser;
  let chairUser: AuthenticatedUser;
  let memberUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    caseService = createCaseServiceForTests(prismaService);

    secretaryUser = await createRoleUser(environment.prisma, {
      email: 'matrix-secretary@ethics.local',
      oidcSubjectId: 'matrix-secretary-oidc',
      role: Role.COUNCIL_SECRETARY,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    chairUser = await createRoleUser(environment.prisma, {
      email: 'matrix-chair@ethics.local',
      oidcSubjectId: 'matrix-chair-oidc',
      role: Role.COUNCIL_CHAIR,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    memberUser = await createRoleUser(environment.prisma, {
      email: 'matrix-member@ethics.local',
      oidcSubjectId: 'matrix-member-oidc',
      role: Role.COUNCIL_MEMBER,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function createRoleUser(
    prisma: PrismaClient,
    input: {
      email: string;
      oidcSubjectId: string;
      role: Role;
      clearanceLevel: ClearanceLevel;
    },
  ): Promise<AuthenticatedUser> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        displayName: input.email,
        oidcSubjectId: input.oidcSubjectId,
        clearanceLevel: input.clearanceLevel,
        provisionedAt: new Date(),
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: input.role,
        assignedBy: user.id,
        reason: 'Stage 1 matrix test',
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [input.role],
      clearanceLevel: input.clearanceLevel,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };
  }

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
          incidentDescription: 'Stage 1 matrix test bildirimi.',
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

  async function countTransitions(caseId: string): Promise<number> {
    return environment.prisma.caseTransition.count({ where: { caseId } });
  }

  it('report_submitted → acknowledge_report → secretariat_review (council_secretary)', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);
    const idempotencyKey = randomUUID();

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey,
        metadata: {},
      },
      randomUUID(),
    );

    expect(result).toMatchObject({
      caseId,
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      idempotentReplay: false,
    });

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.currentState).toBe(CaseState.SECRETARIAT_REVIEW);
  });

  it('secretariat_review → start_pre_research → pre_research', async () => {
    const caseId = await createCaseAtState(CaseState.SECRETARIAT_REVIEW, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.START_PRE_RESEARCH,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.PRE_RESEARCH);
  });

  it('pre_research → submit_to_chair_gate → chair_gate', async () => {
    const caseId = await createCaseAtState(CaseState.PRE_RESEARCH, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_TO_CHAIR_GATE,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.CHAIR_GATE);
  });

  it('chair_gate → approve_agenda → agenda_ready (council_chair)', async () => {
    const caseId = await createCaseAtState(CaseState.CHAIR_GATE, secretaryUser.id);

    const result = await caseService.executeTransition(
      chairUser,
      caseId,
      {
        command: WorkflowCommand.APPROVE_AGENDA,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.AGENDA_READY);
  });

  it('chair_gate → close_not_on_agenda → not_on_agenda_closed (gerekce zorunlu)', async () => {
    const caseId = await createCaseAtState(CaseState.CHAIR_GATE, secretaryUser.id);

    const result = await caseService.executeTransition(
      chairUser,
      caseId,
      {
        command: WorkflowCommand.CLOSE_NOT_ON_AGENDA,
        reason: 'Gundeme alinmadi — yetersiz delil.',
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.NOT_ON_AGENDA_CLOSED);

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.closedAt).not.toBeNull();
  });

  it('asama 1 E2E: report_submitted → ... → agenda_ready', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);

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
    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.START_PRE_RESEARCH,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );
    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_TO_CHAIR_GATE,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );
    await caseService.executeTransition(
      chairUser,
      caseId,
      {
        command: WorkflowCommand.APPROVE_AGENDA,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.currentState).toBe(CaseState.AGENDA_READY);
  });

  it('negatif: yanlis rol → AUTHZ_FORBIDDEN', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        chairUser,
        caseId,
        {
          command: WorkflowCommand.ACKNOWLEDGE_REPORT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('negatif: yanlis state → CASE_INVALID_TRANSITION', async () => {
    const caseId = await createCaseAtState(CaseState.SECRETARIAT_REVIEW, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.ACKNOWLEDGE_REPORT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CASE_INVALID_TRANSITION });
  });

  it('negatif: clearance yetersiz → vaka ABAC scope disinda (404)', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);
    const lowClearanceSecretary: AuthenticatedUser = {
      ...secretaryUser,
      clearanceLevel: ClearanceLevel.NORMAL,
    };

    await expect(
      caseService.executeTransition(
        lowClearanceSecretary,
        caseId,
        {
          command: WorkflowCommand.ACKNOWLEDGE_REPORT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('negatif: council_member stage 1 gecisi yapamaz', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        memberUser,
        caseId,
        {
          command: WorkflowCommand.ACKNOWLEDGE_REPORT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('idempotency: ayni key ile tekrar istek cift gecis uretmez', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);
    const idempotencyKey = randomUUID();

    const first = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey,
        metadata: {},
      },
      randomUUID(),
    );

    const second = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey,
        metadata: {},
      },
      randomUUID(),
    );

    expect(second.idempotentReplay).toBe(true);
    expect(second.transitionId).toBe(first.transitionId);
    expect(await countTransitions(caseId)).toBe(1);

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.currentState).toBe(CaseState.SECRETARIAT_REVIEW);
    expect(stored?.optimisticLockVersion).toBe(1);
  });

  it('side-effect + audit: gecis sonrasi audit_outbox kaydi olusur', async () => {
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

    const auditRecord = await environment.prisma.auditOutbox.findFirst({
      where: { idempotencyKey: `audit:${idempotencyKey}` },
    });

    expect(auditRecord).toMatchObject({
      eventType: 'CASE_TRANSITION',
      resourceId: caseId,
      caseId,
      correlationId,
      dispatchStatus: 'PENDING',
    });
  });

  it('negatif: erisim olmayan vaka → RESOURCE_NOT_FOUND', async () => {
    const caseId = await createCaseAtState(CaseState.REPORT_SUBMITTED, secretaryUser.id);
    const actionOwner = await createRoleUser(environment.prisma, {
      email: 'matrix-owner@ethics.local',
      oidcSubjectId: 'matrix-owner-oidc',
      role: Role.ACTION_OWNER,
      clearanceLevel: ClearanceLevel.SENSITIVE,
    });

    await expect(
      caseService.executeTransition(
        actionOwner,
        caseId,
        {
          command: WorkflowCommand.ACKNOWLEDGE_REPORT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });
});
