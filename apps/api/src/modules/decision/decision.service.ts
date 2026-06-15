import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { CastVoteBody, DecisionVoteListItem } from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  Role,
  TaskEventType,
  TaskStatus,
  TaskType,
  VoteType,
  WorkflowCommand,
  type VoteTypeCode,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { isClearanceSufficient } from '@ethics/policy';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { NotificationService } from '../../notification/notification.service.js';
import { lazyProviderToken } from '../../common/utils/lazy-provider-token.util.js';
import { PolicyScopeService } from '../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { TransitionService } from '../case-management/transition/transition.service.js';
import { recordTaskEvent } from '../task/task-event.writer.js';
import { toCastVoteResponse, toDecisionVoteListItem } from './decision.mapper.js';

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class DecisionService {
  private transitionServiceRef: TransitionService | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyScopeService) private readonly policyScope: PolicyScopeService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(CryptoService) private readonly cryptoService: CryptoService,
    @Inject(NotificationService) private readonly notificationService: NotificationService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  wireTransitionServiceForTests(transitionService: TransitionService): void {
    this.transitionServiceRef = transitionService;
  }

  private get transitionService(): TransitionService {
    if (this.transitionServiceRef) {
      return this.transitionServiceRef;
    }

    return this.moduleRef.get(
      lazyProviderToken<TransitionService>(
        '../case-management/transition/transition.service.js',
        'TransitionService',
      ),
      { strict: false },
    );
  }

  async listVotes(user: AuthenticatedUser, caseId: string): Promise<DecisionVoteListItem[]> {
    await this.assertCaseAccessible(user, caseId);
    this.assertVoteListRole(user);

    const activeTransition = await this.findActiveMemberApprovalTransition(caseId, this.prisma);
    if (!activeTransition) {
      return [];
    }

    const votes = await this.prisma.decisionVote.findMany({
      where: { caseId, transitionId: activeTransition.id },
      orderBy: { votedAt: 'asc' },
      include: {
        voter: {
          select: { displayName: true },
        },
      },
    });

    return votes.map(toDecisionVoteListItem);
  }

  async castVote(
    user: AuthenticatedUser,
    caseId: string,
    body: CastVoteBody,
    correlationId: string,
  ): Promise<{ id: string; voteType: VoteTypeCode; votedAt: string }> {
    this.assertCouncilMember(user);

    const auditIdempotencyKey = `decision-vote:${body.idempotencyKey}`;
    const existingAudit = await this.prisma.auditOutbox.findUnique({
      where: { idempotencyKey: auditIdempotencyKey },
      select: { metadataJson: true },
    });

    if (existingAudit?.metadataJson && typeof existingAudit.metadataJson === 'object') {
      const metadata = existingAudit.metadataJson as Record<string, unknown>;
      if (metadata.caseId === caseId && typeof metadata.voteId === 'string') {
        const existingVote = await this.prisma.decisionVote.findUnique({
          where: { id: metadata.voteId },
        });
        if (existingVote) {
          return toCastVoteResponse(existingVote);
        }
      }
    }

    await this.assertCaseAccessible(user, caseId);

    const caseEntity = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        currentState: true,
        confidentialityLevel: true,
        companyId: true,
      },
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (caseEntity.currentState !== CaseState.MEMBER_APPROVAL) {
      throw new DomainException(
        ErrorCode.DECISION_VOTE_INVALID_STATE,
        'Oy verme yalnızca üye onay aşamasında yapılabilir.',
        HttpStatus.CONFLICT,
      );
    }

    if (
      !isClearanceSufficient(user.clearanceLevel, caseEntity.confidentialityLevel as ClearanceLevel)
    ) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu vaka için yeterli gizlilik yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }

    const activeTransition = await this.findActiveMemberApprovalTransition(caseId, this.prisma);
    if (!activeTransition) {
      throw new DomainException(
        ErrorCode.DECISION_VOTE_INVALID_STATE,
        'Aktif üye onay turu bulunamadı.',
        HttpStatus.CONFLICT,
      );
    }

    const reasonPlaintext = body.reason?.trim() ?? null;
    let reasonText: string | null = null;
    let encryptionMetadata: Prisma.InputJsonValue | undefined;

    if (body.voteType === VoteType.REJECT && reasonPlaintext) {
      const encrypted = await this.cryptoService.encryptField(
        reasonPlaintext,
        'decision_vote_reason',
        caseId,
      );
      reasonText = encrypted.ciphertext;
      encryptionMetadata = {
        encryptedDek: encrypted.encryptedDek,
        kmsKeyId: encrypted.kmsKeyId,
        algorithm: encrypted.algorithm,
      };
    }

    try {
      const createdVoteId = await this.prisma.$transaction(async (tx) => {
        const currentCase = await tx.case.findUniqueOrThrow({
          where: { id: caseId },
          select: {
            currentState: true,
            optimisticLockVersion: true,
            companyId: true,
          },
        });

        if (currentCase.currentState !== CaseState.MEMBER_APPROVAL) {
          throw new DomainException(
            ErrorCode.DECISION_VOTE_INVALID_STATE,
            'Oy verme yalnızca üye onay aşamasında yapılabilir.',
            HttpStatus.CONFLICT,
          );
        }

        const vote = await tx.decisionVote.create({
          data: {
            caseId,
            transitionId: activeTransition.id,
            voterUserId: user.id,
            voteType: body.voteType,
            reasonText,
            encryptionMetadata,
            isSilentAcceptance: false,
            createdBySystem: false,
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.DECISION_VOTE_CAST,
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: 'decision_vote_cast',
          outcome: AuditOutcome.SUCCESS,
          resourceType: 'decision_vote',
          resourceId: vote.id,
          caseId,
          companyId: caseEntity.companyId,
          correlationId,
          idempotencyKey: auditIdempotencyKey,
          metadata: {
            caseId,
            voteId: vote.id,
            voterUserId: user.id,
            voteType: body.voteType,
            isSilentAcceptance: false,
            transitionId: activeTransition.id,
          },
        });

        await this.completeMemberApprovalTask(
          tx,
          caseId,
          activeTransition.id,
          user.id,
          AuditActorType.USER,
        );

        if (body.voteType === VoteType.REJECT) {
          await this.transitionService.executeInTransaction(
            tx,
            {
              caseId,
              command: WorkflowCommand.MEMBER_OBJECTION,
              actor: {
                type: AuditActorType.USER,
                userId: user.id,
                roles: user.roles,
                clearanceLevel: user.clearanceLevel,
              },
              idempotencyKey: `member-objection:${activeTransition.id}:${user.id}:${body.idempotencyKey}`,
              correlationId,
              metadata: { objectionSummary: '[REDACTED]' },
            },
            {
              snapshotState: CaseState.MEMBER_APPROVAL,
              snapshotVersion: currentCase.optimisticLockVersion,
              companyId: currentCase.companyId,
            },
          );
          return vote.id;
        }

        await this.advanceToDecisionDraftIfUnanimous(
          tx,
          caseId,
          activeTransition.id,
          correlationId,
        );

        return vote.id;
      });

      const vote = await this.prisma.decisionVote.findUniqueOrThrow({
        where: { id: createdVoteId },
      });

      return toCastVoteResponse(vote);
    } catch (error) {
      if (
        error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          ErrorCode.DECISION_VOTE_ALREADY_CAST,
          'Bu onay turu için zaten oy kullandınız.',
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  async isUnanimityComplete(caseId: string, tx: DbClient = this.prisma): Promise<boolean> {
    const caseEntity = await tx.case.findUnique({
      where: { id: caseId },
      select: { currentState: true },
    });

    if (!caseEntity || caseEntity.currentState !== CaseState.MEMBER_APPROVAL) {
      return false;
    }

    const activeTransition = await this.findActiveMemberApprovalTransition(caseId, tx);
    if (!activeTransition) {
      return false;
    }

    return this.isUnanimityCompleteForTransition(caseId, activeTransition.id, tx);
  }

  async isUnanimityCompleteForTransition(
    caseId: string,
    transitionId: string,
    tx: DbClient = this.prisma,
  ): Promise<boolean> {
    const memberIds = await this.listEligibleCouncilMemberIds(tx);
    if (memberIds.length === 0) {
      return false;
    }

    const votes = await tx.decisionVote.findMany({
      where: { caseId, transitionId },
      select: { voterUserId: true, voteType: true },
    });

    if (votes.length < memberIds.length) {
      return false;
    }

    const voteByMember = new Map(votes.map((vote) => [vote.voterUserId, vote.voteType]));

    for (const memberId of memberIds) {
      const voteType = voteByMember.get(memberId);
      if (!voteType) {
        return false;
      }

      if (voteType !== VoteType.APPROVE && voteType !== VoteType.SILENT_ACCEPTANCE) {
        return false;
      }
    }

    return true;
  }

  async createSilentAcceptanceVote(
    tx: Prisma.TransactionClient,
    input: {
      caseId: string;
      transitionId: string;
      voterUserId: string;
      companyId: string;
      correlationId: string;
    },
  ): Promise<{ created: boolean; voteId?: string }> {
    const idempotencyKey = `silent-acceptance:${input.transitionId}:${input.voterUserId}`;

    const existingAudit = await tx.auditOutbox.findUnique({
      where: { idempotencyKey },
      select: { metadataJson: true },
    });

    if (existingAudit?.metadataJson && typeof existingAudit.metadataJson === 'object') {
      const metadata = existingAudit.metadataJson as Record<string, unknown>;
      if (typeof metadata.voteId === 'string') {
        return { created: false, voteId: metadata.voteId };
      }
    }

    const existingVote = await tx.decisionVote.findUnique({
      where: {
        transitionId_voterUserId: {
          transitionId: input.transitionId,
          voterUserId: input.voterUserId,
        },
      },
    });

    if (existingVote) {
      return { created: false, voteId: existingVote.id };
    }

    const vote = await tx.decisionVote.create({
      data: {
        caseId: input.caseId,
        transitionId: input.transitionId,
        voterUserId: input.voterUserId,
        voteType: VoteType.SILENT_ACCEPTANCE,
        isSilentAcceptance: true,
        createdBySystem: true,
      },
    });

    await this.auditPublisher.publish(tx, {
      eventType: AuditEventType.SILENT_ACCEPTANCE_CREATED,
      actorType: AuditActorType.SYSTEM,
      actorId: undefined,
      action: 'silent_acceptance_created',
      outcome: AuditOutcome.SUCCESS,
      resourceType: 'decision_vote',
      resourceId: vote.id,
      caseId: input.caseId,
      companyId: input.companyId,
      correlationId: input.correlationId,
      idempotencyKey,
      metadata: {
        caseId: input.caseId,
        voteId: vote.id,
        voterUserId: input.voterUserId,
        voteType: VoteType.SILENT_ACCEPTANCE,
        isSilentAcceptance: true,
        transitionId: input.transitionId,
        reason: 'timeout',
      },
    });

    await this.completeMemberApprovalTask(
      tx,
      input.caseId,
      input.transitionId,
      input.voterUserId,
      AuditActorType.SYSTEM,
    );

    await this.notificationService.enqueueSilentAcceptanceCreated(tx, {
      caseId: input.caseId,
      voterUserId: input.voterUserId,
      correlationId: input.correlationId,
      idempotencyKey,
    });

    return { created: true, voteId: vote.id };
  }

  async advanceToDecisionDraftIfUnanimous(
    tx: Prisma.TransactionClient,
    caseId: string,
    transitionId: string,
    correlationId: string,
  ): Promise<boolean> {
    const isComplete = await this.isUnanimityCompleteForTransition(caseId, transitionId, tx);
    if (!isComplete) {
      return false;
    }

    const caseEntity = await tx.case.findUniqueOrThrow({
      where: { id: caseId },
      select: {
        currentState: true,
        optimisticLockVersion: true,
        companyId: true,
      },
    });

    if (caseEntity.currentState !== CaseState.MEMBER_APPROVAL) {
      return false;
    }

    await this.transitionService.executeInTransaction(
      tx,
      {
        caseId,
        command: WorkflowCommand.CREATE_DECISION_DRAFT,
        actor: {
          type: AuditActorType.SYSTEM,
          userId: undefined,
          roles: [],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
        idempotencyKey: `decision-unanimity:${transitionId}`,
        correlationId,
        metadata: {},
      },
      {
        snapshotState: CaseState.MEMBER_APPROVAL,
        snapshotVersion: caseEntity.optimisticLockVersion,
        companyId: caseEntity.companyId,
      },
    );

    return true;
  }

  async findActiveMemberApprovalTransition(
    caseId: string,
    db: DbClient,
  ): Promise<{ id: string; transitionedAt: Date } | null> {
    return db.caseTransition.findFirst({
      where: {
        caseId,
        toState: CaseState.MEMBER_APPROVAL,
      },
      orderBy: { transitionedAt: 'desc' },
      select: {
        id: true,
        transitionedAt: true,
      },
    });
  }

  async listEligibleCouncilMemberIds(db: DbClient = this.prisma): Promise<string[]> {
    const members = await db.user.findMany({
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
      orderBy: { id: 'asc' },
    });

    return members.map((member) => member.id);
  }

  private async completeMemberApprovalTask(
    tx: Prisma.TransactionClient,
    caseId: string,
    transitionId: string,
    userId: string,
    actorType: (typeof AuditActorType)[keyof typeof AuditActorType],
  ): Promise<void> {
    const task = await tx.task.findFirst({
      where: {
        caseId,
        taskType: TaskType.MEMBER_APPROVAL_TASK,
        createdByTransitionId: transitionId,
        assignedUserId: userId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
    });

    if (!task) {
      return;
    }

    const completedAt = new Date();

    await tx.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.COMPLETED,
        completedByUserId: userId,
        completedAt,
        outcome: VoteType.APPROVE,
      },
    });

    await recordTaskEvent(tx, {
      taskId: task.id,
      eventType: TaskEventType.COMPLETED,
      actorType,
      actorUserId: actorType === AuditActorType.USER ? userId : null,
      metadata: {
        via: 'decision_vote',
      },
    });
  }

  private assertCouncilMember(user: AuthenticatedUser): void {
    if (!user.roles.includes(Role.COUNCIL_MEMBER)) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu işlem için kurul üyesi rolü gerekir.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertVoteListRole(user: AuthenticatedUser): void {
    const allowed = [Role.COUNCIL_SECRETARY, Role.COUNCIL_CHAIR, Role.COUNCIL_MEMBER];
    if (!allowed.some((role) => user.roles.includes(role))) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Kurul oyları listesini görüntüleme yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async assertCaseAccessible(user: AuthenticatedUser, caseId: string): Promise<void> {
    const scope = this.policyScope.buildCaseScope(user) as Prisma.CaseWhereInput;
    const caseEntity = await this.prisma.case.findFirst({
      where: {
        AND: [{ id: caseId }, scope],
      },
      select: { id: true },
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
