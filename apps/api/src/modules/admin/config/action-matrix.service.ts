import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ActionMatrixChangeProposal,
  ActionMatrixListItem,
  ApproveActionMatrixBatchBody,
  ApproveActionMatrixBatchResponse,
  UpdateActionMatrixBody,
} from '@ethics/dto';
import {
  AdminActionCode,
  ADMIN_ACTION_CODE_VALUES,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  type AdminActionCodeValue,
  type Role as RoleCode,
} from '@ethics/shared';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ActionMatrixConfigService } from '../maker-checker/action-matrix-config.service.js';
import {
  DEFAULT_ACTION_MATRIX,
  getRolePrivilegeRank,
} from '../maker-checker/default-action-matrix.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';

const ACTION_MATRIX_CHANGE = AdminActionCode.ACTION_MATRIX_CHANGE;

@Injectable()
export class ActionMatrixAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(ActionMatrixConfigService)
    private readonly actionMatrixConfig: ActionMatrixConfigService,
  ) {}

  async listMatrix(): Promise<ActionMatrixListItem[]> {
    const [dbConfigs, pendingItems] = await Promise.all([
      this.prisma.actionMatrixConfig.findMany({ where: { isActive: true } }),
      this.prisma.actionMatrixChangeItem.findMany({
        where: { batch: { status: 'PENDING' } },
        select: { actionCode: true, batchId: true },
      }),
    ]);

    const dbByAction = new Map(dbConfigs.map((config) => [config.actionCode, config]));
    const pendingBatchByAction = new Map(
      pendingItems.map((item) => [item.actionCode, item.batchId] as const),
    );

    return DEFAULT_ACTION_MATRIX.map((defaultEntry) => {
      const dbConfig = dbByAction.get(defaultEntry.actionCode);
      const effective = this.actionMatrixConfig.getEntry(defaultEntry.actionCode);

      return {
        actionCode: defaultEntry.actionCode,
        makerRole: effective.makerRole,
        checkerRole: effective.checkerRole,
        updatedAt: (dbConfig?.updatedAt ?? new Date(0)).toISOString(),
        pendingBatchId: pendingBatchByAction.get(defaultEntry.actionCode) ?? null,
      };
    });
  }

  async proposeChange(
    actor: AuthenticatedUser,
    actionCode: AdminActionCodeValue,
    body: UpdateActionMatrixBody,
    correlationId: string,
  ): Promise<ActionMatrixChangeProposal> {
    this.makerChecker.assertMaker(actor, ACTION_MATRIX_CHANGE);

    if (!ADMIN_ACTION_CODE_VALUES.includes(actionCode)) {
      throw new DomainException(
        ErrorCode.ADMIN_ACTION_MATRIX_NOT_FOUND,
        `Bilinmeyen aksiyon kodu: ${actionCode}`,
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertValidRolePair(body.makerRole as RoleCode, body.checkerRole as RoleCode);

    const current = this.actionMatrixConfig.getEntry(actionCode);

    if (current.makerRole === body.makerRole && current.checkerRole === body.checkerRole) {
      throw new DomainException(
        ErrorCode.ADMIN_ACTION_MATRIX_UNCHANGED,
        'Yeni maker/checker rolleri mevcut değerlerle aynı.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pending = await this.prisma.actionMatrixChangeItem.findFirst({
      where: {
        actionCode,
        batch: { status: 'PENDING' },
      },
    });

    if (pending) {
      throw new DomainException(
        ErrorCode.ADMIN_ACTION_MATRIX_PENDING,
        `${actionCode} için zaten onay bekleyen bir değişiklik var.`,
        HttpStatus.CONFLICT,
      );
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.actionMatrixChangeBatch.create({
        data: {
          requestedBy: actor.id,
          reason: body.reason,
          items: {
            create: {
              actionCode,
              currentMakerRole: current.makerRole,
              proposedMakerRole: body.makerRole,
              currentCheckerRole: current.checkerRole,
              proposedCheckerRole: body.checkerRole,
            },
          },
        },
        include: { items: true },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.ACTION_MATRIX_CHANGED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'action_matrix_change_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'action_matrix_change_batch',
        resourceId: createdBatch.id,
        correlationId,
        idempotencyKey: `action-matrix-request:${createdBatch.id}`,
        metadata: {
          batch_id: createdBatch.id,
          action_id: actionCode,
          maker_user_id: actor.id,
          reason: body.reason,
          old_maker_role: current.makerRole,
          new_maker_role: body.makerRole,
          old_checker_role: current.checkerRole,
          new_checker_role: body.checkerRole,
        },
      });

      return createdBatch;
    });

    return {
      batchId: batch.id,
      status: 'PENDING',
      reason: batch.reason,
      requestedBy: batch.requestedBy,
      requestedAt: batch.createdAt.toISOString(),
      items: batch.items.map((item) => ({
        actionCode: item.actionCode,
        currentMakerRole: item.currentMakerRole,
        proposedMakerRole: item.proposedMakerRole,
        currentCheckerRole: item.currentCheckerRole,
        proposedCheckerRole: item.proposedCheckerRole,
      })),
    };
  }

  async approveBatch(
    checker: AuthenticatedUser,
    batchId: string,
    body: ApproveActionMatrixBatchBody,
    correlationId: string,
  ): Promise<ApproveActionMatrixBatchResponse> {
    const batch = await this.prisma.actionMatrixChangeBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch || batch.status !== 'PENDING') {
      throw new DomainException(
        ErrorCode.ADMIN_ACTION_MATRIX_BATCH_NOT_FOUND,
        'Onay bekleyen aksiyon matrisi değişikliği bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(checker, batch.requestedBy, ACTION_MATRIX_CHANGE);

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.actionMatrixChangeBatch.update({
          where: { id: batch.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.ACTION_MATRIX_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'action_matrix_change_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'action_matrix_change_batch',
          resourceId: batch.id,
          correlationId,
          idempotencyKey: `action-matrix-reject:${batch.id}:${checker.id}`,
          metadata: {
            batch_id: batch.id,
            checker_user_id: checker.id,
            maker_user_id: batch.requestedBy,
            reason: body.reason,
          },
        });

        return updated;
      });

      return {
        batchId: rejected.id,
        status: 'REJECTED',
        appliedActionCodes: [],
      };
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const appliedActionCodes: string[] = [];

      for (const item of batch.items) {
        this.assertValidRolePair(
          item.proposedMakerRole as RoleCode,
          item.proposedCheckerRole as RoleCode,
        );

        await tx.actionMatrixConfig.upsert({
          where: { actionCode: item.actionCode },
          create: {
            actionCode: item.actionCode,
            makerRole: item.proposedMakerRole,
            checkerRole: item.proposedCheckerRole,
            approvedBy: checker.id,
          },
          update: {
            makerRole: item.proposedMakerRole,
            checkerRole: item.proposedCheckerRole,
            versionNo: { increment: 1 },
            approvedBy: checker.id,
          },
        });

        appliedActionCodes.push(item.actionCode);

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.ACTION_MATRIX_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'action_matrix_changed',
          outcome: AuditOutcome.ALLOWED,
          resourceType: 'action_matrix_config',
          resourceId: item.actionCode,
          correlationId,
          idempotencyKey: `action-matrix-apply:${batch.id}:${item.actionCode}`,
          metadata: {
            action_id: item.actionCode,
            old_maker_role: item.currentMakerRole,
            new_maker_role: item.proposedMakerRole,
            old_checker_role: item.currentCheckerRole,
            new_checker_role: item.proposedCheckerRole,
            reason: body.reason,
            maker_user_id: batch.requestedBy,
            checker_user_id: checker.id,
            batch_id: batch.id,
          },
        });
      }

      const updatedBatch = await tx.actionMatrixChangeBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      return { updatedBatch, appliedActionCodes };
    });

    await this.actionMatrixConfig.reload();

    return {
      batchId: approved.updatedBatch.id,
      status: 'APPROVED',
      appliedActionCodes: approved.appliedActionCodes,
    };
  }

  private assertValidRolePair(makerRole: RoleCode, checkerRole: RoleCode): void {
    if (makerRole === checkerRole) {
      throw new DomainException(
        ErrorCode.ADMIN_ACTION_MATRIX_INVALID_ROLES,
        'Maker ve checker rolü aynı olamaz.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (getRolePrivilegeRank(checkerRole) < getRolePrivilegeRank(makerRole)) {
      throw new DomainException(
        ErrorCode.ADMIN_ACTION_MATRIX_INVALID_ROLES,
        'Checker rolü maker rolünden düşük yetkili olamaz.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
