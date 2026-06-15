import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import {
  ApprovalWorkItemStatus,
  ErrorCode,
  resolveApprovalCategory,
  type AdminActionCodeValue,
  type ApprovalCategoryCode,
  type ApprovalWorkItemTargetTypeCode,
  type ClearanceLevel as ClearanceLevelCode,
  type Role as RoleCode,
} from '@ethics/shared';
import type { ApprovalWorkItem, Prisma } from '@prisma/client';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { NotificationService } from '../../../notification/notification.service.js';
import { ActionMatrixConfigService } from './action-matrix-config.service.js';

export interface CreateApprovalWorkItemInput {
  actionCode: AdminActionCodeValue;
  requestedBy: string;
  targetType: ApprovalWorkItemTargetTypeCode;
  targetId: string;
  summary: string;
  correlationId: string;
  category?: ApprovalCategoryCode;
}

@Injectable()
export class ApprovalWorkItemService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ActionMatrixConfigService)
    private readonly actionMatrixConfig: ActionMatrixConfigService,
    @Optional()
    @Inject(NotificationService)
    private readonly notificationService?: NotificationService,
  ) {}

  buildRoleAssignmentSummary(params: { roleCode: RoleCode; targetDisplayName: string }): string {
    return `Rol ataması: ${params.roleCode} — ${params.targetDisplayName}`;
  }

  buildClearanceChangeSummary(params: {
    currentLevel: ClearanceLevelCode;
    requestedLevel: ClearanceLevelCode;
    targetDisplayName: string;
  }): string {
    return `Clearance değişikliği: ${params.currentLevel} → ${params.requestedLevel} — ${params.targetDisplayName}`;
  }

  buildSystemSettingBatchSummary(settingKeys: readonly string[]): string {
    const [firstKey, ...rest] = settingKeys;
    if (!firstKey) {
      return 'Sistem ayarı değişikliği';
    }
    if (rest.length === 0) {
      return `Sistem ayarı değişikliği: ${firstKey}`;
    }
    return `Sistem ayarı değişikliği: ${firstKey} (+${String(rest.length)} daha)`;
  }

  buildFieldVisibilityBatchSummary(changeCount: number): string {
    return `Alan görünürlüğü değişikliği: ${String(changeCount)} kural`;
  }

  buildActionMatrixBatchSummary(actionCode: AdminActionCodeValue): string {
    return `Aksiyon matrisi değişikliği: ${actionCode}`;
  }

  buildSlaPolicyBatchSummary(taskTypes: readonly string[]): string {
    const [firstType, ...rest] = taskTypes;
    if (!firstType) {
      return 'SLA politikası değişikliği';
    }
    if (rest.length === 0) {
      return `SLA politikası değişikliği: ${firstType}`;
    }
    return `SLA politikası değişikliği: ${firstType} (+${String(rest.length)} daha)`;
  }

  buildNotificationTemplateBatchSummary(templateCodes: readonly string[]): string {
    const [firstCode, ...rest] = templateCodes;
    if (!firstCode) {
      return 'Bildirim şablonu değişikliği';
    }
    if (rest.length === 0) {
      return `Bildirim şablonu değişikliği: ${firstCode}`;
    }
    return `Bildirim şablonu değişikliği: ${firstCode} (+${String(rest.length)} daha)`;
  }

  buildKvkkTextBatchSummary(versionCode: string): string {
    return `KVKK metni yayını: ${versionCode}`;
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateApprovalWorkItemInput,
  ): Promise<ApprovalWorkItem> {
    const existingPending = await tx.approvalWorkItem.findFirst({
      where: {
        targetType: input.targetType,
        targetId: input.targetId,
        status: ApprovalWorkItemStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new DomainException(
        ErrorCode.APPROVAL_WORK_ITEM_PENDING,
        'Bu hedef için zaten bekleyen bir onay işi var.',
        HttpStatus.CONFLICT,
      );
    }

    const category = input.category ?? resolveApprovalCategory(input.actionCode);
    const { checkerRole } = this.actionMatrixConfig.getEntry(input.actionCode);

    const workItem = await tx.approvalWorkItem.create({
      data: {
        category,
        actionCode: input.actionCode,
        assignedCheckerRole: checkerRole,
        requestedBy: input.requestedBy,
        status: ApprovalWorkItemStatus.PENDING,
        summary: input.summary,
        targetType: input.targetType,
        targetId: input.targetId,
        correlationId: input.correlationId,
      },
    });

    if (this.notificationService) {
      await this.notificationService.enqueueApprovalWorkItemAssigned(tx, {
        workItemId: workItem.id,
        checkerRole,
        requestedBy: input.requestedBy,
        correlationId: input.correlationId,
        category,
      });
    }

    return workItem;
  }

  async create(input: CreateApprovalWorkItemInput): Promise<ApprovalWorkItem> {
    return this.prisma.$transaction((tx) => this.createInTransaction(tx, input));
  }

  async closeInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      targetType: ApprovalWorkItemTargetTypeCode;
      targetId: string;
      decidedBy: string;
      approved: boolean;
      reason: string;
    },
  ): Promise<ApprovalWorkItem | null> {
    const pending = await tx.approvalWorkItem.findFirst({
      where: {
        targetType: params.targetType,
        targetId: params.targetId,
        status: ApprovalWorkItemStatus.PENDING,
      },
    });

    if (!pending) {
      return null;
    }

    return tx.approvalWorkItem.update({
      where: { id: pending.id },
      data: {
        status: params.approved
          ? ApprovalWorkItemStatus.COMPLETED
          : ApprovalWorkItemStatus.REJECTED,
        decidedBy: params.decidedBy,
        decidedAt: new Date(),
        decisionReason: params.reason,
      },
    });
  }
}
