import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ApproveSlaPolicyBatchBody,
  ApproveSlaPolicyBatchResponse,
  SlaPolicyChangeProposal,
  SlaPolicyConfigSnapshot,
  SlaPolicyListItem,
  UpdateSlaPolicyBody,
} from '@ethics/dto';
import {
  AdminActionCode,
  ApprovalWorkItemTargetType,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  TASK_TYPE_VALUES,
  type TaskTypeCode,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ApprovalWorkItemService } from '../maker-checker/approval-work-item.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import {
  configsEqual,
  toSlaPolicyConfigSnapshot,
  validateSlaPolicySnapshot,
} from './sla-policy.mapper.js';

const SLA_POLICY_ACTION = AdminActionCode.SLA_POLICY_CHANGE;

/**
 * MVP recalc policy: Takvim veya SLA politikası değişikliği mevcut açık görevlerin
 * `sla_due_at` alanını otomatik yeniden hesaplamaz. Yeni atanan görevler güncel
 * konfigürasyonla hesaplanır; mevcut görevler atama anındaki snapshot ile kalır.
 */
@Injectable()
export class SlaPolicyAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(ApprovalWorkItemService)
    private readonly approvalWorkItemService: ApprovalWorkItemService,
  ) {}

  async listPolicies(): Promise<SlaPolicyListItem[]> {
    const [policies, pendingItems] = await Promise.all([
      this.prisma.slaPolicyConfig.findMany({
        where: { isActive: true },
        orderBy: { taskType: 'asc' },
      }),
      this.prisma.slaPolicyChangeItem.findMany({
        where: { batch: { status: 'PENDING' } },
        select: { taskType: true, batchId: true },
      }),
    ]);

    const pendingBatchByTaskType = new Map(
      pendingItems.map((item) => [item.taskType, item.batchId] as const),
    );

    return policies.map((policy) => ({
      taskType: policy.taskType as TaskTypeCode,
      ...toSlaPolicyConfigSnapshot(policy),
      updatedAt: policy.updatedAt.toISOString(),
      pendingBatchId: pendingBatchByTaskType.get(policy.taskType) ?? null,
    }));
  }

  async proposeChange(
    actor: AuthenticatedUser,
    taskType: TaskTypeCode,
    body: UpdateSlaPolicyBody,
    correlationId: string,
  ): Promise<SlaPolicyChangeProposal> {
    this.makerChecker.assertMaker(actor, SLA_POLICY_ACTION);

    if (!TASK_TYPE_VALUES.includes(taskType)) {
      throw new DomainException(
        ErrorCode.ADMIN_SLA_POLICY_NOT_FOUND,
        'Geçersiz görev tipi.',
        HttpStatus.NOT_FOUND,
      );
    }

    const policy = await this.prisma.slaPolicyConfig.findUnique({
      where: { taskType },
    });

    if (!policy || !policy.isActive) {
      throw new DomainException(
        ErrorCode.ADMIN_SLA_POLICY_NOT_FOUND,
        'SLA politikası bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const currentConfig = toSlaPolicyConfigSnapshot(policy);
    const proposedConfig: SlaPolicyConfigSnapshot = {
      slaDuration: body.slaDuration ?? currentConfig.slaDuration,
      slaUnit: body.slaUnit ?? currentConfig.slaUnit,
      warningThresholdHours: body.warningThresholdHours ?? currentConfig.warningThresholdHours,
      dailyOverdueNotification:
        body.dailyOverdueNotification ?? currentConfig.dailyOverdueNotification,
      escalationRole: body.escalationRole ?? currentConfig.escalationRole,
    };

    const validationError = validateSlaPolicySnapshot(proposedConfig);
    if (validationError) {
      throw new DomainException(
        ErrorCode.ADMIN_SLA_POLICY_INVALID,
        validationError,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (configsEqual(currentConfig, proposedConfig)) {
      throw new DomainException(
        ErrorCode.ADMIN_SLA_POLICY_UNCHANGED,
        'Yeni SLA konfigürasyonu mevcut değerle aynı.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pending = await this.prisma.slaPolicyChangeItem.findFirst({
      where: {
        taskType,
        batch: { status: 'PENDING' },
      },
    });

    if (pending) {
      throw new DomainException(
        ErrorCode.ADMIN_SLA_POLICY_PENDING,
        'Bu görev tipi için zaten onay bekleyen bir değişiklik var.',
        HttpStatus.CONFLICT,
      );
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.slaPolicyChangeBatch.create({
        data: {
          requestedBy: actor.id,
          reason: body.reason,
          items: {
            create: {
              taskType,
              currentConfig: currentConfig,
              proposedConfig: proposedConfig,
            },
          },
        },
        include: { items: true },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.SLA_POLICY_CHANGED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'sla_policy_change_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'sla_policy_change_batch',
        resourceId: createdBatch.id,
        correlationId,
        idempotencyKey: `sla-policy-request:${createdBatch.id}`,
        metadata: {
          batch_id: createdBatch.id,
          maker_user_id: actor.id,
          reason: body.reason,
          task_type: taskType,
          old_config: currentConfig,
          new_config: proposedConfig,
        },
      });

      await this.approvalWorkItemService.createInTransaction(tx, {
        actionCode: SLA_POLICY_ACTION,
        requestedBy: actor.id,
        targetType: ApprovalWorkItemTargetType.SLA_POLICY_BATCH,
        targetId: createdBatch.id,
        summary: this.approvalWorkItemService.buildSlaPolicyBatchSummary([taskType]),
        correlationId,
      });

      return createdBatch;
    });

    return this.toProposal(batch);
  }

  async approveBatch(
    checker: AuthenticatedUser,
    batchId: string,
    body: ApproveSlaPolicyBatchBody,
    correlationId: string,
  ): Promise<ApproveSlaPolicyBatchResponse> {
    const batch = await this.prisma.slaPolicyChangeBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch || batch.status !== 'PENDING') {
      throw new DomainException(
        ErrorCode.ADMIN_SLA_POLICY_BATCH_NOT_FOUND,
        'Onay bekleyen SLA değişikliği bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(checker, batch.requestedBy, SLA_POLICY_ACTION);

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.slaPolicyChangeBatch.update({
          where: { id: batch.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.SLA_POLICY_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'sla_policy_change_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'sla_policy_change_batch',
          resourceId: batch.id,
          correlationId,
          idempotencyKey: `sla-policy-reject:${batch.id}:${checker.id}`,
          metadata: {
            batch_id: batch.id,
            checker_user_id: checker.id,
            maker_user_id: batch.requestedBy,
            reason: body.reason,
            task_types: batch.items.map((item) => item.taskType),
          },
        });

        await this.approvalWorkItemService.closeInTransaction(tx, {
          targetType: ApprovalWorkItemTargetType.SLA_POLICY_BATCH,
          targetId: batch.id,
          decidedBy: checker.id,
          approved: false,
          reason: body.reason,
        });

        return updated;
      });

      return {
        batchId: rejected.id,
        status: 'REJECTED',
        appliedTaskTypes: [],
      };
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const appliedTaskTypes: TaskTypeCode[] = [];

      for (const item of batch.items) {
        const policy = await tx.slaPolicyConfig.findUnique({
          where: { taskType: item.taskType },
        });

        if (!policy || !policy.isActive) {
          throw new DomainException(
            ErrorCode.ADMIN_SLA_POLICY_NOT_FOUND,
            `SLA politikası bulunamadı: ${item.taskType}`,
            HttpStatus.NOT_FOUND,
          );
        }

        const proposedConfig = item.proposedConfig as SlaPolicyConfigSnapshot;

        await tx.slaPolicyConfig.update({
          where: { taskType: item.taskType },
          data: {
            slaDuration: proposedConfig.slaDuration,
            slaUnit: proposedConfig.slaUnit,
            warningThresholdHours: proposedConfig.warningThresholdHours,
            dailyOverdueNotification: proposedConfig.dailyOverdueNotification,
            escalationRole: proposedConfig.escalationRole,
            versionNo: { increment: 1 },
            approvedBy: checker.id,
          },
        });

        appliedTaskTypes.push(item.taskType as TaskTypeCode);

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.SLA_POLICY_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'sla_policy_changed',
          outcome: AuditOutcome.ALLOWED,
          resourceType: 'sla_policy_config',
          resourceId: policy.id,
          correlationId,
          idempotencyKey: `sla-policy-apply:${batch.id}:${item.taskType}`,
          metadata: {
            task_type: item.taskType,
            old_config: item.currentConfig,
            new_config: item.proposedConfig,
            reason: body.reason,
            maker_user_id: batch.requestedBy,
            checker_user_id: checker.id,
            batch_id: batch.id,
          },
        });
      }

      const updatedBatch = await tx.slaPolicyChangeBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      await this.approvalWorkItemService.closeInTransaction(tx, {
        targetType: ApprovalWorkItemTargetType.SLA_POLICY_BATCH,
        targetId: batch.id,
        decidedBy: checker.id,
        approved: true,
        reason: body.reason,
      });

      return { updatedBatch, appliedTaskTypes };
    });

    return {
      batchId: approved.updatedBatch.id,
      status: 'APPROVED',
      appliedTaskTypes: approved.appliedTaskTypes,
    };
  }

  private toProposal(
    batch: Prisma.SlaPolicyChangeBatchGetPayload<{ include: { items: true } }>,
  ): SlaPolicyChangeProposal {
    return {
      batchId: batch.id,
      status: 'PENDING',
      reason: batch.reason,
      requestedBy: batch.requestedBy,
      requestedAt: batch.createdAt.toISOString(),
      items: batch.items.map((item) => ({
        taskType: item.taskType as TaskTypeCode,
        currentConfig: item.currentConfig as SlaPolicyConfigSnapshot,
        proposedConfig: item.proposedConfig as SlaPolicyConfigSnapshot,
      })),
    };
  }
}
