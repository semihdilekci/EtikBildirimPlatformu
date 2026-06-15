import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ApproveKvkkTextBatchBody,
  ApproveKvkkTextBatchResponse,
  CreateKvkkTextBody,
  KvkkTextChangeProposal,
  KvkkTextListItem,
} from '@ethics/dto';
import {
  AdminActionCode,
  ApprovalWorkItemTargetType,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  Role,
} from '@ethics/shared';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ApprovalWorkItemService } from '../maker-checker/approval-work-item.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';

const KVKK_TEXT_ACTION = AdminActionCode.KVKK_TEXT_PUBLISH;

@Injectable()
export class KvkkTextAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(ApprovalWorkItemService)
    private readonly approvalWorkItemService: ApprovalWorkItemService,
  ) {}

  assertKvkkReader(actor: AuthenticatedUser): void {
    if (actor.roles.includes(Role.ADMIN) || actor.roles.includes(Role.COUNCIL_SECRETARY)) {
      return;
    }

    throw new DomainException(
      ErrorCode.AUTHZ_FORBIDDEN,
      'KVKK metinlerini görüntüleme yetkiniz yok.',
      HttpStatus.FORBIDDEN,
    );
  }

  async listTexts(actor: AuthenticatedUser): Promise<KvkkTextListItem[]> {
    this.assertKvkkReader(actor);

    const [versions, pendingBatches] = await Promise.all([
      this.prisma.kvkkConsentVersion.findMany({
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.kvkkTextChangeBatch.findMany({
        where: { status: 'PENDING' },
        include: { items: true },
      }),
    ]);

    const pendingBatchByVersion = new Map(
      pendingBatches.flatMap((batch) =>
        batch.items.map((item) => [item.versionCode, batch.id] as const),
      ),
    );

    return versions.map((version) => ({
      id: version.id,
      versionCode: version.versionCode,
      contentText: version.contentText,
      effectiveDate: version.publishedAt?.toISOString() ?? null,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      status: this.resolveVersionStatus(version, pendingBatchByVersion.has(version.versionCode)),
      isActive: version.isActive,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
      pendingBatchId: pendingBatchByVersion.get(version.versionCode) ?? null,
    }));
  }

  async proposePublish(
    actor: AuthenticatedUser,
    body: CreateKvkkTextBody,
    correlationId: string,
  ): Promise<KvkkTextChangeProposal> {
    this.makerChecker.assertMaker(actor, KVKK_TEXT_ACTION);
    this.assertKvkkReader(actor);

    const effectiveDate = new Date(`${body.effectiveDate}T00:00:00.000Z`);
    if (Number.isNaN(effectiveDate.getTime())) {
      throw new DomainException(
        ErrorCode.ADMIN_KVKK_TEXT_INVALID,
        'Geçersiz yürürlük tarihi.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingVersion = await this.prisma.kvkkConsentVersion.findUnique({
      where: { versionCode: body.versionCode },
    });

    if (existingVersion) {
      throw new DomainException(
        ErrorCode.ADMIN_KVKK_TEXT_VERSION_CONFLICT,
        'Bu versiyon kodu zaten mevcut.',
        HttpStatus.CONFLICT,
      );
    }

    const pendingForVersion = await this.prisma.kvkkTextChangeItem.findFirst({
      where: {
        versionCode: body.versionCode,
        batch: { status: 'PENDING' },
      },
    });

    if (pendingForVersion) {
      throw new DomainException(
        ErrorCode.ADMIN_KVKK_TEXT_PENDING,
        'Bu versiyon için zaten onay bekleyen bir yayın talebi var.',
        HttpStatus.CONFLICT,
      );
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.kvkkTextChangeBatch.create({
        data: {
          requestedBy: actor.id,
          reason: body.reason,
          items: {
            create: {
              versionCode: body.versionCode,
              contentText: body.contentText,
              effectiveDate,
            },
          },
        },
        include: { items: true },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.KVKK_TEXT_PUBLISHED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'kvkk_text_publish_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'kvkk_text_change_batch',
        resourceId: createdBatch.id,
        correlationId,
        idempotencyKey: `kvkk-text-request:${createdBatch.id}`,
        metadata: {
          batch_id: createdBatch.id,
          maker_user_id: actor.id,
          reason: body.reason,
          version: body.versionCode,
          effective_date: body.effectiveDate,
        },
      });

      await this.approvalWorkItemService.createInTransaction(tx, {
        actionCode: KVKK_TEXT_ACTION,
        requestedBy: actor.id,
        targetType: ApprovalWorkItemTargetType.KVKK_TEXT_BATCH,
        targetId: createdBatch.id,
        summary: this.approvalWorkItemService.buildKvkkTextBatchSummary(body.versionCode),
        correlationId,
      });

      return createdBatch;
    });

    return this.toProposal(batch);
  }

  async approveBatch(
    checker: AuthenticatedUser,
    batchId: string,
    body: ApproveKvkkTextBatchBody,
    correlationId: string,
  ): Promise<ApproveKvkkTextBatchResponse> {
    const batch = await this.prisma.kvkkTextChangeBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch || batch.status !== 'PENDING' || batch.items.length !== 1) {
      throw new DomainException(
        ErrorCode.ADMIN_KVKK_TEXT_BATCH_NOT_FOUND,
        'Onay bekleyen KVKK metin yayını bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(checker, batch.requestedBy, KVKK_TEXT_ACTION);

    const item = batch.items[0];
    if (!item) {
      throw new DomainException(
        ErrorCode.ADMIN_KVKK_TEXT_BATCH_NOT_FOUND,
        'Onay bekleyen KVKK metin yayını bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.kvkkTextChangeBatch.update({
          where: { id: batch.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.KVKK_TEXT_PUBLISHED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'kvkk_text_publish_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'kvkk_text_change_batch',
          resourceId: batch.id,
          correlationId,
          idempotencyKey: `kvkk-text-reject:${batch.id}:${checker.id}`,
          metadata: {
            batch_id: batch.id,
            checker_user_id: checker.id,
            maker_user_id: batch.requestedBy,
            reason: body.reason,
            version: item.versionCode,
          },
        });

        await this.approvalWorkItemService.closeInTransaction(tx, {
          targetType: ApprovalWorkItemTargetType.KVKK_TEXT_BATCH,
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
        publishedVersionCode: null,
      };
    }

    const existingVersion = await this.prisma.kvkkConsentVersion.findUnique({
      where: { versionCode: item.versionCode },
    });

    if (existingVersion) {
      throw new DomainException(
        ErrorCode.ADMIN_KVKK_TEXT_VERSION_CONFLICT,
        'Bu versiyon kodu yayın sırasında zaten mevcut.',
        HttpStatus.CONFLICT,
      );
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      await tx.kvkkConsentVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      const publishedAt = item.effectiveDate;
      const createdVersion = await tx.kvkkConsentVersion.create({
        data: {
          versionCode: item.versionCode,
          contentText: item.contentText,
          publishedAt,
          isActive: true,
        },
      });

      const updatedBatch = await tx.kvkkTextChangeBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.KVKK_TEXT_PUBLISHED,
        actorType: AuditActorType.USER,
        actorId: checker.id,
        action: 'kvkk_text_published',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'kvkk_consent_version',
        resourceId: createdVersion.id,
        correlationId,
        idempotencyKey: `kvkk-text-publish:${batch.id}`,
        metadata: {
          batch_id: batch.id,
          version: item.versionCode,
          effective_date: item.effectiveDate.toISOString().slice(0, 10),
          maker_user_id: batch.requestedBy,
          checker_user_id: checker.id,
          reason: body.reason,
        },
      });

      await this.approvalWorkItemService.closeInTransaction(tx, {
        targetType: ApprovalWorkItemTargetType.KVKK_TEXT_BATCH,
        targetId: batch.id,
        decidedBy: checker.id,
        approved: true,
        reason: body.reason,
      });

      return { updatedBatch, versionCode: createdVersion.versionCode };
    });

    return {
      batchId: approved.updatedBatch.id,
      status: 'APPROVED',
      publishedVersionCode: approved.versionCode,
    };
  }

  private resolveVersionStatus(
    version: { isActive: boolean; publishedAt: Date | null },
    hasPendingBatch: boolean,
  ): KvkkTextListItem['status'] {
    if (hasPendingBatch) {
      return 'PENDING';
    }

    if (version.isActive) {
      return 'ACTIVE';
    }

    if (version.publishedAt) {
      return 'ARCHIVED';
    }

    return 'DRAFT';
  }

  private toProposal(batch: {
    id: string;
    status: string;
    reason: string;
    requestedBy: string;
    createdAt: Date;
    items: Array<{
      versionCode: string;
      contentText: string;
      effectiveDate: Date;
    }>;
  }): KvkkTextChangeProposal {
    const item = batch.items[0];
    if (!item) {
      throw new Error('KVKK metin değişiklik öğesi bulunamadı.');
    }

    return {
      batchId: batch.id,
      status: batch.status as KvkkTextChangeProposal['status'],
      reason: batch.reason,
      requestedBy: batch.requestedBy,
      requestedAt: batch.createdAt.toISOString(),
      item: {
        versionCode: item.versionCode,
        contentText: item.contentText,
        effectiveDate: item.effectiveDate.toISOString().slice(0, 10),
      },
    };
  }
}
