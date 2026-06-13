import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  NotificationEventType,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  VoteType,
  WORKFLOW_VERSION,
  WorkflowCommand,
} from '@ethics/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { CaseService } from '../case.service.js';
import { createWorkflowBundleForTests } from './case-service.test-factory.js';

describe('Stage 3 + 4 transition matrix (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let transitionService: ReturnType<typeof createWorkflowBundleForTests>['transitionService'];
  let companyId: string;
  let secretaryUser: AuthenticatedUser;
  let boardChairUser: AuthenticatedUser;
  let actionOwnerUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    const bundle = createWorkflowBundleForTests(prismaService);
    caseService = bundle.caseService;
    transitionService = bundle.transitionService;

    secretaryUser = await createRoleUser(environment.prisma, {
      email: 'stage34-secretary@ethics.local',
      oidcSubjectId: 'stage34-secretary-oidc',
      role: Role.COUNCIL_SECRETARY,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    boardChairUser = await createRoleUser(environment.prisma, {
      email: 'stage34-board-chair@ethics.local',
      oidcSubjectId: 'stage34-board-chair-oidc',
      role: Role.BOARD_CHAIR,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    actionOwnerUser = await createRoleUser(environment.prisma, {
      email: 'stage34-owner@ethics.local',
      oidcSubjectId: 'stage34-owner-oidc',
      role: Role.ACTION_OWNER,
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
        reason: 'Stage 3+4 matrix test',
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [input.role],
      clearanceLevel: input.clearanceLevel,
      companyId: input.role === Role.ACTION_OWNER ? companyId : null,
      companyName: input.role === Role.ACTION_OWNER ? 'Stage 3+4 Test Company' : null,
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
          incidentDescription: 'Stage 3+4 matrix test bildirimi.',
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

  async function seedUnanimousVotes(caseId: string): Promise<void> {
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

    let members = await environment.prisma.user.findMany({
      where: {
        isActive: true,
        rolesAssigned: {
          some: {
            roleCode: Role.COUNCIL_MEMBER,
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    if (members.length === 0) {
      const member = await environment.prisma.user.create({
        data: {
          email: `stage34-vote-member-${randomUUID()}@ethics.local`,
          displayName: 'Stage34 Vote Member',
          oidcSubjectId: `stage34-vote-member-${randomUUID()}`,
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
          provisionedAt: new Date(),
        },
      });

      await environment.prisma.userRole.create({
        data: {
          userId: member.id,
          roleCode: Role.COUNCIL_MEMBER,
          assignedBy: secretaryUser.id,
          reason: 'Stage 3+4 vote seed',
        },
      });

      members = [{ id: member.id }];
    }

    for (const member of members) {
      await environment.prisma.decisionVote.create({
        data: {
          caseId,
          transitionId: transition.id,
          voterUserId: member.id,
          voteType: VoteType.APPROVE,
        },
      });
    }
  }

  async function advanceToBoardApproved(caseId: string): Promise<void> {
    await seedUnanimousVotes(caseId);

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.CREATE_DECISION_DRAFT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_TO_BOARD_REVIEW,
        idempotencyKey: randomUUID(),
        metadata: { decisionDocumentId: randomUUID() },
      },
      randomUUID(),
    );

    await caseService.executeTransition(
      boardChairUser,
      caseId,
      {
        command: WorkflowCommand.BOARD_APPROVE,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );
  }

  it('member_approval → create_decision_draft → decision_draft', async () => {
    const caseId = await createCaseAtState(CaseState.MEMBER_APPROVAL, secretaryUser.id);
    await seedUnanimousVotes(caseId);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.CREATE_DECISION_DRAFT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.DECISION_DRAFT);
  });

  it('decision_draft → submit_to_board_review → board_chair_review', async () => {
    const caseId = await createCaseAtState(CaseState.DECISION_DRAFT, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_TO_BOARD_REVIEW,
        idempotencyKey: randomUUID(),
        metadata: { decisionDocumentId: randomUUID() },
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.BOARD_CHAIR_REVIEW);
  });

  it('board_chair_review → board_approve → board_approved', async () => {
    const caseId = await createCaseAtState(CaseState.BOARD_CHAIR_REVIEW, secretaryUser.id);

    const result = await caseService.executeTransition(
      boardChairUser,
      caseId,
      {
        command: WorkflowCommand.BOARD_APPROVE,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.BOARD_APPROVED);
  });

  it('board_chair_review → board_veto → agenda_ready (veto dongusu)', async () => {
    const caseId = await createCaseAtState(CaseState.BOARD_CHAIR_REVIEW, secretaryUser.id);

    const result = await caseService.executeTransition(
      boardChairUser,
      caseId,
      {
        command: WorkflowCommand.BOARD_VETO,
        idempotencyKey: randomUUID(),
        reason: 'Karar metni kurul gündemine tekrar alınmalı.',
        metadata: {},
      },
      randomUUID(),
    );

    expect(result).toMatchObject({
      fromState: CaseState.BOARD_CHAIR_REVIEW,
      toState: CaseState.AGENDA_READY,
      command: WorkflowCommand.BOARD_VETO,
    });
  });

  it('asama 3 E2E: member_approval → board_approved', async () => {
    const caseId = await createCaseAtState(CaseState.MEMBER_APPROVAL, secretaryUser.id);
    await advanceToBoardApproved(caseId);

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.currentState).toBe(CaseState.BOARD_APPROVED);
  });

  it('board_approved → prepare_implementation_letter → implementation_letter_prepared', async () => {
    const caseId = await createCaseAtState(CaseState.BOARD_APPROVED, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.IMPLEMENTATION_LETTER_PREPARED);
  });

  it('implementation_letter_prepared → assign_action → action_assigned', async () => {
    const caseId = await createCaseAtState(
      CaseState.IMPLEMENTATION_LETTER_PREPARED,
      secretaryUser.id,
    );

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ASSIGN_ACTION,
        idempotencyKey: randomUUID(),
        metadata: { actionOwnerUserId: actionOwnerUser.id },
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.ACTION_ASSIGNED);

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.assignedActionOwnerId).toBe(actionOwnerUser.id);
  });

  it('action_assigned → begin_action_response → action_response_pending (sistem)', async () => {
    const caseId = await createCaseAtState(CaseState.ACTION_ASSIGNED, secretaryUser.id);
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { assignedActionOwnerId: actionOwnerUser.id },
    });

    const result = await transitionService.execute({
      caseId,
      command: WorkflowCommand.BEGIN_ACTION_RESPONSE,
      actor: {
        type: AuditActorType.SYSTEM,
        roles: [],
        clearanceLevel: ClearanceLevel.NORMAL,
      },
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    expect(result.toState).toBe(CaseState.ACTION_RESPONSE_PENDING);
  });

  it('action_response_pending → submit_action_response → agenda_ready', async () => {
    const caseId = await createCaseAtState(CaseState.ACTION_RESPONSE_PENDING, secretaryUser.id);
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { assignedActionOwnerId: actionOwnerUser.id },
    });

    const result = await transitionService.execute({
      caseId,
      command: WorkflowCommand.SUBMIT_ACTION_RESPONSE,
      actor: {
        type: AuditActorType.USER,
        userId: actionOwnerUser.id,
        roles: actionOwnerUser.roles,
        clearanceLevel: actionOwnerUser.clearanceLevel,
      },
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
      metadata: {},
    });

    expect(result.toState).toBe(CaseState.AGENDA_READY);
  });

  it('agenda_ready → submit_follow_up_review → follow_up_decision', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_FOLLOW_UP_REVIEW,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.FOLLOW_UP_DECISION);
  });

  it('follow_up_decision → follow_up_close → closed_archived', async () => {
    const caseId = await createCaseAtState(CaseState.FOLLOW_UP_DECISION, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.FOLLOW_UP_CLOSE,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.CLOSED_ARCHIVED);

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.closedAt).not.toBeNull();
  });

  it('follow_up_decision → follow_up_reassign → action_assigned (aksiyon dongusu)', async () => {
    const caseId = await createCaseAtState(CaseState.FOLLOW_UP_DECISION, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.FOLLOW_UP_REASSIGN,
        idempotencyKey: randomUUID(),
        metadata: { actionOwnerUserId: actionOwnerUser.id },
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.ACTION_ASSIGNED);

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.assignedActionOwnerId).toBe(actionOwnerUser.id);
  });

  it('asama 4 E2E: board_approved → closed_archived', async () => {
    const caseId = await createCaseAtState(CaseState.MEMBER_APPROVAL, secretaryUser.id);
    await advanceToBoardApproved(caseId);

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ASSIGN_ACTION,
        idempotencyKey: randomUUID(),
        metadata: { actionOwnerUserId: actionOwnerUser.id },
      },
      randomUUID(),
    );

    await transitionService.execute({
      caseId,
      command: WorkflowCommand.BEGIN_ACTION_RESPONSE,
      actor: {
        type: AuditActorType.SYSTEM,
        roles: [],
        clearanceLevel: ClearanceLevel.NORMAL,
      },
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });

    await transitionService.execute({
      caseId,
      command: WorkflowCommand.SUBMIT_ACTION_RESPONSE,
      actor: {
        type: AuditActorType.USER,
        userId: actionOwnerUser.id,
        roles: actionOwnerUser.roles,
        clearanceLevel: actionOwnerUser.clearanceLevel,
      },
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
      metadata: {},
    });

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_FOLLOW_UP_REVIEW,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.FOLLOW_UP_CLOSE,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.currentState).toBe(CaseState.CLOSED_ARCHIVED);
    expect(stored?.closedAt).not.toBeNull();
  });

  it('side-effect: notification outbox ayni transaction ile yazilir', async () => {
    const caseId = await createCaseAtState(CaseState.BOARD_APPROVED, secretaryUser.id);
    const idempotencyKey = randomUUID();
    const correlationId = randomUUID();

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER,
        idempotencyKey,
        metadata: {},
      },
      correlationId,
    );

    const notification = await environment.prisma.notificationEvent.findFirst({
      where: { idempotencyKey: `notification:${idempotencyKey}` },
    });

    expect(notification).toMatchObject({
      eventType: NotificationEventType.CASE_TRANSITION,
      caseId,
      correlationId,
      dispatchStatus: 'PENDING',
    });

    const auditRecord = await environment.prisma.auditOutbox.findFirst({
      where: { idempotencyKey: `audit:${idempotencyKey}` },
    });
    expect(auditRecord).toBeTruthy();
  });

  it('negatif: create_decision_draft oy birliği yok → DECISION_UNANIMITY_NOT_MET', async () => {
    const caseId = await createCaseAtState(CaseState.MEMBER_APPROVAL, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.CREATE_DECISION_DRAFT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.DECISION_UNANIMITY_NOT_MET });
  });

  it('negatif: submit_to_board_review decisionDocumentId eksik → VALIDATION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.DECISION_DRAFT, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.SUBMIT_TO_BOARD_REVIEW,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('negatif: board_veto gerekce eksik → VALIDATION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.BOARD_CHAIR_REVIEW, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        boardChairUser,
        caseId,
        {
          command: WorkflowCommand.BOARD_VETO,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('negatif: council_secretary board_approve yapamaz → AUTHZ_FORBIDDEN', async () => {
    const caseId = await createCaseAtState(CaseState.BOARD_CHAIR_REVIEW, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.BOARD_APPROVE,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('negatif: atanmamis action_owner submit_action_response → AUTHZ_FORBIDDEN', async () => {
    const caseId = await createCaseAtState(CaseState.ACTION_RESPONSE_PENDING, secretaryUser.id);
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { assignedActionOwnerId: actionOwnerUser.id },
    });

    const otherOwner = await createRoleUser(environment.prisma, {
      email: 'stage34-other-owner@ethics.local',
      oidcSubjectId: 'stage34-other-owner-oidc',
      role: Role.ACTION_OWNER,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    await expect(
      transitionService.execute({
        caseId,
        command: WorkflowCommand.SUBMIT_ACTION_RESPONSE,
        actor: {
          type: AuditActorType.USER,
          userId: otherOwner.id,
          roles: otherOwner.roles,
          clearanceLevel: otherOwner.clearanceLevel,
        },
        idempotencyKey: randomUUID(),
        correlationId: randomUUID(),
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('negatif: follow_up_reassign actionOwnerUserId eksik → VALIDATION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.FOLLOW_UP_DECISION, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.FOLLOW_UP_REASSIGN,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});
