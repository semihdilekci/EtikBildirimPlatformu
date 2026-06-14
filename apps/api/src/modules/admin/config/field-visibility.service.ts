import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ApproveFieldVisibilityBatchBody,
  ApproveFieldVisibilityBatchResponse,
  FieldVisibilityMatrixResponse,
  UpdateFieldVisibilityBody,
  FieldVisibilityChangeProposal,
} from '@ethics/dto';
import { CASE_FIELD_VALUES, CaseField, FieldVisibility } from '@ethics/policy';
import {
  AdminActionCode,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  ROLE_VALUES,
  type Role as RoleCode,
} from '@ethics/shared';

import { FieldVisibilityPolicyService } from '../../../authorization/field-visibility-policy.service.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import { assertAdminFieldVisibilityAllowed } from './field-visibility.rules.js';

const FIELD_VISIBILITY_ACTION = AdminActionCode.FIELD_VISIBILITY_CHANGE;

interface PreparedFieldVisibilityChange {
  roleCode: RoleCode;
  fieldName: CaseField;
  currentVisibility: FieldVisibility;
  proposedVisibility: FieldVisibility;
}

@Injectable()
export class FieldVisibilityAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(FieldVisibilityPolicyService)
    private readonly fieldVisibilityPolicy: FieldVisibilityPolicyService,
  ) {}

  async getMatrix(): Promise<FieldVisibilityMatrixResponse> {
    const matrix = this.fieldVisibilityPolicy.getMatrixSnapshot();
    const pendingItems = await this.prisma.fieldVisibilityChangeItem.findMany({
      where: { batch: { status: 'PENDING' } },
      select: {
        roleCode: true,
        fieldName: true,
        batchId: true,
      },
    });

    const pendingBatchByCell = new Map(
      pendingItems.map((item) => [`${item.roleCode}:${item.fieldName}`, item.batchId] as const),
    );

    const items = ROLE_VALUES.flatMap((roleCode) =>
      CASE_FIELD_VALUES.map((fieldName) => ({
        roleCode,
        fieldName,
        visibility: matrix[roleCode][fieldName],
        pendingBatchId: pendingBatchByCell.get(`${roleCode}:${fieldName}`) ?? null,
      })),
    );

    return {
      roles: [...ROLE_VALUES],
      fields: [...CASE_FIELD_VALUES],
      matrix: items,
    };
  }

  async proposeChanges(
    actor: AuthenticatedUser,
    body: UpdateFieldVisibilityBody,
    correlationId: string,
  ): Promise<FieldVisibilityChangeProposal> {
    this.makerChecker.assertMaker(actor, FIELD_VISIBILITY_ACTION);

    const uniqueCells = new Set(
      body.changes.map((change) => `${change.roleCode}:${change.fieldName}`),
    );
    if (uniqueCells.size !== body.changes.length) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Aynı rol-alan kombinasyonu birden fazla kez gönderilemez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const prepared = await this.prepareChanges(body.changes);

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.fieldVisibilityChangeBatch.create({
        data: {
          requestedBy: actor.id,
          reason: body.reason,
          items: {
            create: prepared.map((change) => ({
              roleCode: change.roleCode,
              fieldName: change.fieldName,
              currentVisibility: change.currentVisibility,
              proposedVisibility: change.proposedVisibility,
            })),
          },
        },
        include: { items: true },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.FIELD_VISIBILITY_CHANGED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'field_visibility_change_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'field_visibility_change_batch',
        resourceId: createdBatch.id,
        correlationId,
        idempotencyKey: `field-visibility-request:${createdBatch.id}`,
        metadata: {
          batch_id: createdBatch.id,
          maker_user_id: actor.id,
          reason: body.reason,
          changed_fields: prepared.map((change) => ({
            role_code: change.roleCode,
            field_name: change.fieldName,
            current_visibility: change.currentVisibility,
            proposed_visibility: change.proposedVisibility,
          })),
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
        roleCode: item.roleCode,
        fieldName: item.fieldName,
        currentVisibility: item.currentVisibility as FieldVisibility,
        proposedVisibility: item.proposedVisibility as FieldVisibility,
      })),
    };
  }

  async approveBatch(
    checker: AuthenticatedUser,
    batchId: string,
    body: ApproveFieldVisibilityBatchBody,
    correlationId: string,
  ): Promise<ApproveFieldVisibilityBatchResponse> {
    const batch = await this.prisma.fieldVisibilityChangeBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch || batch.status !== 'PENDING') {
      throw new DomainException(
        ErrorCode.ADMIN_FIELD_VISIBILITY_BATCH_NOT_FOUND,
        'Onay bekleyen alan görünürlük değişikliği bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(checker, batch.requestedBy, FIELD_VISIBILITY_ACTION);

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.fieldVisibilityChangeBatch.update({
          where: { id: batch.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.FIELD_VISIBILITY_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'field_visibility_change_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'field_visibility_change_batch',
          resourceId: batch.id,
          correlationId,
          idempotencyKey: `field-visibility-reject:${batch.id}:${checker.id}`,
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
        appliedChanges: [],
      };
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const appliedChanges: Array<{ roleCode: string; fieldName: string }> = [];

      for (const item of batch.items) {
        await tx.fieldVisibilityConfig.upsert({
          where: {
            roleCode_fieldName: {
              roleCode: item.roleCode,
              fieldName: item.fieldName,
            },
          },
          create: {
            roleCode: item.roleCode,
            fieldName: item.fieldName,
            visibility: item.proposedVisibility,
            approvedBy: checker.id,
          },
          update: {
            visibility: item.proposedVisibility,
            versionNo: { increment: 1 },
            approvedBy: checker.id,
          },
        });

        appliedChanges.push({
          roleCode: item.roleCode,
          fieldName: item.fieldName,
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.FIELD_VISIBILITY_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'field_visibility_changed',
          outcome: AuditOutcome.ALLOWED,
          resourceType: 'field_visibility_config',
          resourceId: `${item.roleCode}:${item.fieldName}`,
          correlationId,
          idempotencyKey: `field-visibility-apply:${batch.id}:${item.roleCode}:${item.fieldName}`,
          metadata: {
            role_code: item.roleCode,
            field_name: item.fieldName,
            old_visibility: item.currentVisibility,
            new_visibility: item.proposedVisibility,
            reason: body.reason,
            maker_user_id: batch.requestedBy,
            checker_user_id: checker.id,
            batch_id: batch.id,
          },
        });
      }

      const updatedBatch = await tx.fieldVisibilityChangeBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      return { updatedBatch, appliedChanges };
    });

    await this.fieldVisibilityPolicy.reload();

    return {
      batchId: approved.updatedBatch.id,
      status: 'APPROVED',
      appliedChanges: approved.appliedChanges,
    };
  }

  private async prepareChanges(
    changes: UpdateFieldVisibilityBody['changes'],
  ): Promise<PreparedFieldVisibilityChange[]> {
    const matrix = this.fieldVisibilityPolicy.getMatrixSnapshot();
    const prepared: PreparedFieldVisibilityChange[] = [];

    for (const change of changes) {
      const roleCode = change.roleCode as RoleCode;
      const fieldName = change.fieldName;
      const proposedVisibility = change.visibility;

      assertAdminFieldVisibilityAllowed(roleCode, fieldName, change.visibility);

      const currentVisibility = matrix[roleCode][fieldName];

      if (currentVisibility === proposedVisibility) {
        throw new DomainException(
          ErrorCode.ADMIN_FIELD_VISIBILITY_UNCHANGED,
          `${roleCode}/${fieldName} için yeni görünürlük mevcut değerle aynı.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const pending = await this.prisma.fieldVisibilityChangeItem.findFirst({
        where: {
          roleCode,
          fieldName,
          batch: { status: 'PENDING' },
        },
      });

      if (pending) {
        throw new DomainException(
          ErrorCode.ADMIN_FIELD_VISIBILITY_PENDING,
          `${roleCode}/${fieldName} için zaten onay bekleyen bir değişiklik var.`,
          HttpStatus.CONFLICT,
        );
      }

      prepared.push({
        roleCode,
        fieldName,
        currentVisibility,
        proposedVisibility,
      });
    }

    return prepared;
  }
}
