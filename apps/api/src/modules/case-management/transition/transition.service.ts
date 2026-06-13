import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventType, AuditOutcome, ErrorCode, Role, WorkflowCommand } from '@ethics/shared';
import type { CaseStateCode, WorkflowCommandCode, ClearanceLevel } from '@ethics/shared';
import { isClearanceSufficient } from '@ethics/policy';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { resolveTransition } from './transition.commands.js';
import { TransitionSideEffects } from './transition.side-effects.js';
import type {
  ExecuteTransitionInput,
  TransitionResult,
  TransitionValidationContext,
} from './transition.types.js';
import { TransitionValidators } from './transition.validators.js';

@Injectable()
export class TransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validators: TransitionValidators,
    private readonly sideEffects: TransitionSideEffects,
    private readonly auditPublisher: AuditEventPublisher,
  ) {}

  async execute(input: ExecuteTransitionInput): Promise<TransitionResult> {
    const existing = await this.prisma.caseTransition.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      const caseEntity = await this.prisma.case.findUnique({
        where: { id: existing.caseId },
      });

      if (!caseEntity || caseEntity.id !== input.caseId) {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Idempotency key başka bir vakaya ait.',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.toResult(existing, caseEntity.optimisticLockVersion, true, []);
    }

    const caseEntity = await this.prisma.case.findUnique({
      where: { id: input.caseId },
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const snapshotState = caseEntity.currentState as CaseStateCode;
    const snapshotVersion = caseEntity.optimisticLockVersion;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.caseId}))`;

        const currentCase = await tx.case.findUnique({
          where: { id: input.caseId },
        });

        if (!currentCase) {
          throw new DomainException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Vaka bulunamadı.',
            HttpStatus.NOT_FOUND,
          );
        }

        if (
          currentCase.currentState !== snapshotState ||
          currentCase.optimisticLockVersion !== snapshotVersion
        ) {
          throw new DomainException(
            ErrorCode.CASE_OPTIMISTIC_LOCK,
            'Kayıt başka bir kullanıcı tarafından güncellendi.',
            HttpStatus.CONFLICT,
          );
        }

        const fromState = currentCase.currentState;
        const definition = resolveTransition(fromState, input.command);

        if (!definition) {
          throw new DomainException(
            ErrorCode.CASE_INVALID_TRANSITION,
            'Bu işlem vakanın mevcut durumunda yapılamaz.',
            HttpStatus.CONFLICT,
          );
        }

        const validationContext: TransitionValidationContext = {
          caseEntity: currentCase,
          command: input.command,
          definition,
          actor: input.actor,
          reason: input.reason,
          metadata: input.metadata,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
        };

        this.validators.validate(validationContext);
        await this.validateAsyncPreconditions(validationContext);

        const updatedCase = await tx.case.update({
          where: {
            id: input.caseId,
            optimisticLockVersion: currentCase.optimisticLockVersion,
          },
          data: {
            currentState: definition.toState,
            optimisticLockVersion: { increment: 1 },
            ...(definition.closesCase ? { closedAt: new Date() } : {}),
            ...this.buildAssignmentUpdate(input.command, input.metadata),
          },
        });

        const transition = await tx.caseTransition.create({
          data: {
            caseId: input.caseId,
            fromState,
            toState: definition.toState,
            command: input.command,
            actorType: input.actor.type,
            performedByUserId: input.actor.userId ?? null,
            reasonTextMasked: input.reason?.trim() ? '[REDACTED]' : null,
            idempotencyKey: input.idempotencyKey,
          },
        });

        const tasksCreated = await this.sideEffects.apply(tx, validationContext, transition);

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.CASE_TRANSITION,
          actorType: input.actor.type,
          actorId: input.actor.userId,
          action: 'case_transition',
          outcome: AuditOutcome.SUCCESS,
          resourceType: 'case',
          resourceId: input.caseId,
          caseId: input.caseId,
          companyId: caseEntity.companyId,
          correlationId: input.correlationId,
          idempotencyKey: `audit:${input.idempotencyKey}`,
          metadata: {
            fromState,
            toState: definition.toState,
            command: input.command,
            transitionId: transition.id,
          },
        });

        return this.toResult(transition, updatedCase.optimisticLockVersion, false, tasksCreated);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new DomainException(
          ErrorCode.CASE_OPTIMISTIC_LOCK,
          'Kayıt başka bir kullanıcı tarafından güncellendi.',
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  private buildAssignmentUpdate(
    command: WorkflowCommandCode,
    metadata: Record<string, unknown> | undefined,
  ): Prisma.CaseUpdateInput {
    if (command === WorkflowCommand.ASSIGN_RAPPORTEUR) {
      const rapporteurUserId = metadata?.rapporteurUserId;
      if (typeof rapporteurUserId !== 'string') {
        return {};
      }

      return { assignedRapporteur: { connect: { id: rapporteurUserId } } };
    }

    if (
      command === WorkflowCommand.ASSIGN_ACTION ||
      command === WorkflowCommand.FOLLOW_UP_REASSIGN
    ) {
      const actionOwnerUserId = metadata?.actionOwnerUserId;
      if (typeof actionOwnerUserId !== 'string') {
        return {};
      }

      return { assignedActionOwner: { connect: { id: actionOwnerUserId } } };
    }

    return {};
  }

  private async validateAsyncPreconditions(context: TransitionValidationContext): Promise<void> {
    if (context.command === WorkflowCommand.ASSIGN_RAPPORTEUR) {
      const rapporteurUserId = context.metadata?.rapporteurUserId;
      if (typeof rapporteurUserId !== 'string') {
        return;
      }

      await this.assertActiveUserWithRole(
        rapporteurUserId,
        Role.RAPPORTEUR,
        'Atanan kullanıcı raportör rolüne sahip değil.',
      );
      await this.assertUserClearanceForCase(
        rapporteurUserId,
        context.caseEntity.confidentialityLevel as ClearanceLevel,
      );
      return;
    }

    if (
      context.command === WorkflowCommand.ASSIGN_ACTION ||
      context.command === WorkflowCommand.FOLLOW_UP_REASSIGN
    ) {
      const actionOwnerUserId = context.metadata?.actionOwnerUserId;
      if (typeof actionOwnerUserId !== 'string') {
        return;
      }

      await this.assertActiveUserWithRole(
        actionOwnerUserId,
        Role.ACTION_OWNER,
        'Atanan kullanıcı aksiyon sahibi rolüne sahip değil.',
      );
      await this.assertUserClearanceForCase(
        actionOwnerUserId,
        context.caseEntity.confidentialityLevel as ClearanceLevel,
      );
    }
  }

  private async assertActiveUserWithRole(
    userId: string,
    role: Role,
    message: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        rolesAssigned: {
          some: {
            roleCode: role,
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.CASE_PRECONDITION_FAILED,
        message,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async assertUserClearanceForCase(
    userId: string,
    caseClearance: ClearanceLevel,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { clearanceLevel: true },
    });

    if (!user || !isClearanceSufficient(user.clearanceLevel as ClearanceLevel, caseClearance)) {
      throw new DomainException(
        ErrorCode.CASE_PRECONDITION_FAILED,
        'Atanan kullanıcının gizlilik yetkisi vaka seviyesi için yetersiz.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private toResult(
    transition: {
      id: string;
      caseId: string;
      fromState: string;
      toState: string;
      command: string;
      transitionedAt: Date;
    },
    optimisticLockVersion: number,
    idempotentReplay: boolean,
    tasksCreated: TransitionResult['tasksCreated'],
  ): TransitionResult {
    return {
      caseId: transition.caseId,
      transitionId: transition.id,
      fromState: transition.fromState as CaseStateCode,
      toState: transition.toState as CaseStateCode,
      command: transition.command as WorkflowCommandCode,
      transitionedAt: transition.transitionedAt,
      optimisticLockVersion,
      idempotentReplay,
      tasksCreated,
    };
  }
}
