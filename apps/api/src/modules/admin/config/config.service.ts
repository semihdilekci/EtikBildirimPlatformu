import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ApproveSystemSettingBatchBody,
  ApproveSystemSettingBatchResponse,
  BulkUpdateSystemSettingsBody,
  SystemSettingChangeProposal,
  SystemSettingListItem,
  SystemSettingValue,
  UpdateSystemSettingBody,
} from '@ethics/dto';
import {
  AdminActionCode,
  ApprovalWorkItemTargetType,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  getSystemSettingDefinition,
  isKnownSystemSettingKey,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ApprovalWorkItemService } from '../maker-checker/approval-work-item.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import {
  toSystemSettingListItem,
  validateSettingValue,
  valuesEqual,
} from './system-settings.mapper.js';

const SYSTEM_SETTING_ACTION = AdminActionCode.SYSTEM_SETTING_CHANGE;

interface ProposedChange {
  key: string;
  value: SystemSettingValue;
}

@Injectable()
export class ConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(ApprovalWorkItemService)
    private readonly approvalWorkItemService: ApprovalWorkItemService,
  ) {}

  async listSystemSettings(): Promise<SystemSettingListItem[]> {
    const [settings, pendingItems] = await Promise.all([
      this.prisma.systemSetting.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      }),
      this.prisma.systemSettingChangeItem.findMany({
        where: {
          batch: { status: 'PENDING' },
        },
        select: {
          settingKey: true,
          batchId: true,
        },
      }),
    ]);

    const pendingBatchByKey = new Map(
      pendingItems.map((item) => [item.settingKey, item.batchId] as const),
    );

    return settings.map((setting) => toSystemSettingListItem(setting, pendingBatchByKey));
  }

  async proposeSystemSettingChange(
    actor: AuthenticatedUser,
    key: string,
    body: UpdateSystemSettingBody,
    correlationId: string,
  ): Promise<SystemSettingChangeProposal> {
    return this.createChangeBatch(actor, [{ key, value: body.value }], body.reason, correlationId);
  }

  async proposeBulkSystemSettingChanges(
    actor: AuthenticatedUser,
    body: BulkUpdateSystemSettingsBody,
    correlationId: string,
  ): Promise<SystemSettingChangeProposal> {
    const uniqueKeys = new Set(body.changes.map((change) => change.key));
    if (uniqueKeys.size !== body.changes.length) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Aynı parametre birden fazla kez gönderilemez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.createChangeBatch(actor, body.changes, body.reason, correlationId);
  }

  async approveSystemSettingBatch(
    checker: AuthenticatedUser,
    batchId: string,
    body: ApproveSystemSettingBatchBody,
    correlationId: string,
  ): Promise<ApproveSystemSettingBatchResponse> {
    const batch = await this.prisma.systemSettingChangeBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch || batch.status !== 'PENDING') {
      throw new DomainException(
        ErrorCode.ADMIN_SYSTEM_SETTING_BATCH_NOT_FOUND,
        'Onay bekleyen ayar değişikliği bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(checker, batch.requestedBy, SYSTEM_SETTING_ACTION);

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.systemSettingChangeBatch.update({
          where: { id: batch.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'system_setting_change_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'system_setting_change_batch',
          resourceId: batch.id,
          correlationId,
          idempotencyKey: `system-setting-reject:${batch.id}:${checker.id}`,
          metadata: {
            batch_id: batch.id,
            checker_user_id: checker.id,
            maker_user_id: batch.requestedBy,
            reason: body.reason,
            keys: batch.items.map((item) => item.settingKey),
          },
        });

        await this.approvalWorkItemService.closeInTransaction(tx, {
          targetType: ApprovalWorkItemTargetType.SYSTEM_SETTING_BATCH,
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
        appliedKeys: [],
      };
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const appliedKeys: string[] = [];

      for (const item of batch.items) {
        const setting = await tx.systemSetting.findUnique({
          where: { key: item.settingKey },
        });

        if (!setting) {
          throw new DomainException(
            ErrorCode.ADMIN_SYSTEM_SETTING_NOT_FOUND,
            `Ayar bulunamadı: ${item.settingKey}`,
            HttpStatus.NOT_FOUND,
          );
        }

        await tx.systemSetting.update({
          where: { key: item.settingKey },
          data: {
            value: item.proposedValue as Prisma.InputJsonValue,
            versionNo: { increment: 1 },
            approvedBy: checker.id,
          },
        });

        appliedKeys.push(item.settingKey);

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'system_setting_changed',
          outcome: AuditOutcome.ALLOWED,
          resourceType: 'system_setting',
          resourceId: setting.id,
          correlationId,
          idempotencyKey: `system-setting-apply:${batch.id}:${item.settingKey}`,
          metadata: {
            key: item.settingKey,
            old_value: item.currentValue,
            new_value: item.proposedValue,
            reason: body.reason,
            maker_user_id: batch.requestedBy,
            checker_user_id: checker.id,
            batch_id: batch.id,
          },
        });
      }

      const updatedBatch = await tx.systemSettingChangeBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      await this.approvalWorkItemService.closeInTransaction(tx, {
        targetType: ApprovalWorkItemTargetType.SYSTEM_SETTING_BATCH,
        targetId: batch.id,
        decidedBy: checker.id,
        approved: true,
        reason: body.reason,
      });

      return { updatedBatch, appliedKeys };
    });

    return {
      batchId: approved.updatedBatch.id,
      status: 'APPROVED',
      appliedKeys: approved.appliedKeys,
    };
  }

  private async createChangeBatch(
    actor: AuthenticatedUser,
    changes: readonly ProposedChange[],
    reason: string,
    correlationId: string,
  ): Promise<SystemSettingChangeProposal> {
    this.makerChecker.assertMaker(actor, SYSTEM_SETTING_ACTION);

    const preparedChanges = await this.prepareChanges(changes);

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.systemSettingChangeBatch.create({
        data: {
          requestedBy: actor.id,
          reason,
          items: {
            create: preparedChanges.map((change) => ({
              settingKey: change.key,
              currentValue: change.currentValue as Prisma.InputJsonValue,
              proposedValue: change.proposedValue as Prisma.InputJsonValue,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'system_setting_change_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'system_setting_change_batch',
        resourceId: createdBatch.id,
        correlationId,
        idempotencyKey: `system-setting-request:${createdBatch.id}`,
        metadata: {
          batch_id: createdBatch.id,
          maker_user_id: actor.id,
          reason,
          keys: preparedChanges.map((change) => change.key),
        },
      });

      await this.approvalWorkItemService.createInTransaction(tx, {
        actionCode: SYSTEM_SETTING_ACTION,
        requestedBy: actor.id,
        targetType: ApprovalWorkItemTargetType.SYSTEM_SETTING_BATCH,
        targetId: createdBatch.id,
        summary: this.approvalWorkItemService.buildSystemSettingBatchSummary(
          preparedChanges.map((change) => change.key),
        ),
        correlationId,
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
        key: item.settingKey,
        currentValue: item.currentValue as SystemSettingValue,
        proposedValue: item.proposedValue as SystemSettingValue,
      })),
    };
  }

  private async prepareChanges(changes: readonly ProposedChange[]) {
    const prepared: Array<{
      key: string;
      currentValue: Prisma.JsonValue;
      proposedValue: SystemSettingValue;
    }> = [];

    for (const change of changes) {
      if (!isKnownSystemSettingKey(change.key)) {
        throw new DomainException(
          ErrorCode.ADMIN_SYSTEM_SETTING_NOT_FOUND,
          `Bilinmeyen sistem parametresi: ${change.key}`,
          HttpStatus.NOT_FOUND,
        );
      }

      const definition = getSystemSettingDefinition(change.key);
      if (!definition) {
        throw new DomainException(
          ErrorCode.ADMIN_SYSTEM_SETTING_NOT_FOUND,
          `Bilinmeyen sistem parametresi: ${change.key}`,
          HttpStatus.NOT_FOUND,
        );
      }

      const validationError = validateSettingValue(definition, change.value);
      if (validationError) {
        throw new DomainException(
          ErrorCode.ADMIN_SYSTEM_SETTING_INVALID_VALUE,
          validationError,
          HttpStatus.BAD_REQUEST,
        );
      }

      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: change.key },
      });

      if (!setting || !setting.isActive) {
        throw new DomainException(
          ErrorCode.ADMIN_SYSTEM_SETTING_NOT_FOUND,
          `Ayar bulunamadı: ${change.key}`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (valuesEqual(setting.value, change.value)) {
        throw new DomainException(
          ErrorCode.ADMIN_SYSTEM_SETTING_UNCHANGED,
          `${change.key} için yeni değer mevcut değerle aynı.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const pending = await this.prisma.systemSettingChangeItem.findFirst({
        where: {
          settingKey: change.key,
          batch: { status: 'PENDING' },
        },
      });

      if (pending) {
        throw new DomainException(
          ErrorCode.ADMIN_SYSTEM_SETTING_PENDING,
          `${change.key} için zaten onay bekleyen bir değişiklik var.`,
          HttpStatus.CONFLICT,
        );
      }

      prepared.push({
        key: change.key,
        currentValue: setting.value,
        proposedValue: change.value,
      });
    }

    return prepared;
  }
}
