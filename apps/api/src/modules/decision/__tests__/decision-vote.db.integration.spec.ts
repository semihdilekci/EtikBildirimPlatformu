import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  MEMBER_APPROVAL_SILENT_ACCEPTANCE_MS,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  TaskStatus,
  TaskType,
  VoteType,
  WORKFLOW_VERSION,
  WorkflowCommand,
} from '@ethics/shared';
import type { PrismaClient } from '@prisma/client';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import {
  createDecisionServiceForTests,
  createSilentAcceptanceHandlerForTests,
} from '../../case-management/__tests__/case-service.test-factory.js';
import type { DecisionService } from '../decision.service.js';
import type { SilentAcceptanceHandler } from '../silent-acceptance.handler.js';

describe('Decision vote unanimity integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let decisionService: DecisionService;
  let companyId: string;
  let memberOne: AuthenticatedUser;
  let memberTwo: AuthenticatedUser;
  let secretaryUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    decisionService = createDecisionServiceForTests(prismaService);

    secretaryUser = await createRoleUser(environment.prisma, {
      email: 'decision-unanimity-secretary@ethics.local',
      oidcSubjectId: 'decision-unanimity-secretary-oidc',
      role: Role.COUNCIL_SECRETARY,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    memberOne = await createRoleUser(environment.prisma, {
      email: 'decision-unanimity-member1@ethics.local',
      oidcSubjectId: 'decision-unanimity-member1-oidc',
      role: Role.COUNCIL_MEMBER,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    memberTwo = await createRoleUser(environment.prisma, {
      email: 'decision-unanimity-member2@ethics.local',
      oidcSubjectId: 'decision-unanimity-member2-oidc',
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
        reason: 'Decision unanimity integration test',
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

  async function createMemberApprovalCase(): Promise<{ caseId: string; transitionId: string }> {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    const caseId = await environment.prisma.$transaction(async (tx) => {
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
          incidentDescription: 'Decision unanimity test bildirimi.',
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
          currentState: CaseState.MEMBER_APPROVAL,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          companyId,
          createdBy: secretaryUser.id,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });

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

    return { caseId, transitionId: transition.id };
  }

  it('tüm üyeler onaylayınca decision_draft geçişi tetiklenir', async () => {
    const { caseId } = await createMemberApprovalCase();

    await decisionService.castVote(
      memberOne,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    await decisionService.castVote(
      memberTwo,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    const caseRecord = await environment.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(caseRecord.currentState).toBe(CaseState.DECISION_DRAFT);
  });

  it('negatif: bir üye itiraz edince decision_draft geçişi olmaz', async () => {
    const { caseId } = await createMemberApprovalCase();

    await decisionService.castVote(
      memberOne,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    await decisionService.castVote(
      memberTwo,
      caseId,
      {
        voteType: VoteType.REJECT,
        reason: 'Karar metninde eksiklik var.',
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    const caseRecord = await environment.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(caseRecord.currentState).toBe(CaseState.MEMBER_APPROVAL);

    const rejectVote = await environment.prisma.decisionVote.findFirst({
      where: { caseId, voteType: VoteType.REJECT },
    });
    expect(rejectVote).not.toBeNull();
    expect(rejectVote?.reasonText).not.toBeNull();
  });

  it('negatif: aynı üye ikinci oy → DECISION_VOTE_ALREADY_CAST', async () => {
    const { caseId } = await createMemberApprovalCase();
    const idempotencyKey = randomUUID();

    await decisionService.castVote(
      memberOne,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey,
      },
      randomUUID(),
    );

    await expect(
      decisionService.castVote(
        memberOne,
        caseId,
        {
          voteType: VoteType.APPROVE,
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.DECISION_VOTE_ALREADY_CAST });
  });

  it('listVotes üye onay dışı vakada boş dizi döner', async () => {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    const caseId = await environment.prisma.$transaction(async (tx) => {
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
          incidentDescription: 'List votes empty test.',
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
          createdBy: secretaryUser.id,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });

    const votes = await decisionService.listVotes(secretaryUser, caseId);
    expect(votes).toEqual([]);
  });

  it('negatif: üye onay dışı vakada oy → DECISION_VOTE_INVALID_STATE', async () => {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    const caseId = await environment.prisma.$transaction(async (tx) => {
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
          incidentDescription: 'Invalid vote state test.',
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
          createdBy: secretaryUser.id,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });

    await expect(
      decisionService.castVote(
        memberOne,
        caseId,
        {
          voteType: VoteType.APPROVE,
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.DECISION_VOTE_INVALID_STATE });
  });

  it('negatif: yetkisiz kullanıcı oy veremez', async () => {
    const { caseId } = await createMemberApprovalCase();

    await expect(
      decisionService.castVote(
        secretaryUser,
        caseId,
        {
          voteType: VoteType.APPROVE,
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('oy sonrası üye onay görevi tamamlanır', async () => {
    const { caseId, transitionId } = await createMemberApprovalCase();

    await environment.prisma.task.create({
      data: {
        caseId,
        taskType: TaskType.MEMBER_APPROVAL_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.COUNCIL_MEMBER,
        assignedUserId: memberOne.id,
        createdByTransitionId: transitionId,
      },
    });

    await decisionService.castVote(
      memberOne,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    const memberTask = await environment.prisma.task.findFirst({
      where: {
        caseId,
        assignedUserId: memberOne.id,
        taskType: TaskType.MEMBER_APPROVAL_TASK,
      },
    });

    expect(memberTask?.status).toBe(TaskStatus.COMPLETED);
  });

  it('negatif: listVotes yetkisiz rol → AUTHZ_FORBIDDEN', async () => {
    const { caseId } = await createMemberApprovalCase();

    const adminUser = await createRoleUser(environment.prisma, {
      email: 'decision-list-admin@ethics.local',
      oidcSubjectId: 'decision-list-admin-oidc',
      role: Role.ADMIN,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    await expect(decisionService.listVotes(adminUser, caseId)).rejects.toMatchObject({
      code: ErrorCode.AUTHZ_FORBIDDEN,
    });
  });

  it('listVotes aktif member_approval oylarını döner', async () => {
    const { caseId } = await createMemberApprovalCase();

    await decisionService.castVote(
      memberOne,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    const votes = await decisionService.listVotes(secretaryUser, caseId);

    expect(votes).toHaveLength(1);
    expect(votes[0]?.voteType).toBe(VoteType.APPROVE);
    expect(votes[0]?.voterDisplayName).toBe(memberOne.displayName);
  });
});

describe('Silent acceptance integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let decisionService: DecisionService;
  let silentAcceptanceHandler: SilentAcceptanceHandler;
  let companyId: string;
  let memberUser: AuthenticatedUser;
  let secretaryUser: AuthenticatedUser;
  let fakeNow: Date;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    decisionService = createDecisionServiceForTests(prismaService);

    secretaryUser = await createRoleUser(environment.prisma, {
      email: 'silent-acceptance-secretary@ethics.local',
      oidcSubjectId: 'silent-acceptance-secretary-oidc',
      role: Role.COUNCIL_SECRETARY,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    memberUser = await createRoleUser(environment.prisma, {
      email: 'silent-acceptance-member@ethics.local',
      oidcSubjectId: 'silent-acceptance-member-oidc',
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
        reason: 'Silent acceptance integration test',
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

  async function createMemberApprovalCaseWithTransition(
    transitionedAt: Date,
  ): Promise<{ caseId: string; transitionId: string }> {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    const caseId = await environment.prisma.$transaction(async (tx) => {
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
          incidentDescription: 'Silent acceptance test bildirimi.',
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
          currentState: CaseState.MEMBER_APPROVAL,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          companyId,
          createdBy: secretaryUser.id,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });

    const transition = await environment.prisma.caseTransition.create({
      data: {
        caseId,
        fromState: CaseState.AGENDA_READY,
        toState: CaseState.MEMBER_APPROVAL,
        command: WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL,
        actorType: AuditActorType.USER,
        performedByUserId: secretaryUser.id,
        idempotencyKey: randomUUID(),
        transitionedAt,
      },
    });

    return { caseId, transitionId: transition.id };
  }

  it('24 saat sonra sessiz kabul vote + decision_draft geçişi', async () => {
    const transitionedAt = new Date(Date.now() - MEMBER_APPROVAL_SILENT_ACCEPTANCE_MS - 60_000);
    const { caseId } = await createMemberApprovalCaseWithTransition(transitionedAt);

    fakeNow = new Date(transitionedAt.getTime() + MEMBER_APPROVAL_SILENT_ACCEPTANCE_MS + 1_000);
    silentAcceptanceHandler = createSilentAcceptanceHandlerForTests(
      environment.prisma as unknown as PrismaService,
      { now: () => fakeNow },
    );

    const result = await silentAcceptanceHandler.processPendingBatch();

    expect(result.silentVotesCreated).toBeGreaterThanOrEqual(1);
    expect(result.casesAdvanced).toBeGreaterThanOrEqual(1);

    const caseRecord = await environment.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(caseRecord.currentState).toBe(CaseState.DECISION_DRAFT);

    const silentVote = await environment.prisma.decisionVote.findFirst({
      where: {
        caseId,
        voteType: VoteType.SILENT_ACCEPTANCE,
        voterUserId: memberUser.id,
      },
    });
    expect(silentVote).not.toBeNull();
    expect(silentVote?.createdBySystem).toBe(true);
  });

  it('24 saat dolmadan sessiz kabul tetiklenmez', async () => {
    const transitionedAt = new Date();
    const { caseId } = await createMemberApprovalCaseWithTransition(transitionedAt);

    silentAcceptanceHandler = createSilentAcceptanceHandlerForTests(
      environment.prisma as unknown as PrismaService,
      { now: () => new Date(transitionedAt.getTime() + 60 * 60 * 1000) },
    );

    const result = await silentAcceptanceHandler.processPendingBatch();

    expect(result.silentVotesCreated).toBe(0);
    expect(result.casesAdvanced).toBe(0);

    const caseRecord = await environment.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(caseRecord.currentState).toBe(CaseState.MEMBER_APPROVAL);
  });

  it('üye manuel onay verirse sessiz kabul oluşmaz', async () => {
    const transitionedAt = new Date(Date.now() - MEMBER_APPROVAL_SILENT_ACCEPTANCE_MS - 60_000);
    const { caseId } = await createMemberApprovalCaseWithTransition(transitionedAt);

    await decisionService.castVote(
      memberUser,
      caseId,
      {
        voteType: VoteType.APPROVE,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    const silentVotes = await environment.prisma.decisionVote.count({
      where: {
        caseId,
        voteType: VoteType.SILENT_ACCEPTANCE,
      },
    });
    expect(silentVotes).toBe(0);
  });
});
