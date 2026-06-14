import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ApproveNotificationTemplateBatchBody,
  ApproveNotificationTemplateBatchResponse,
  NotificationTemplateChangeProposal,
  NotificationTemplateConfigSnapshot,
  NotificationTemplateListItem,
  PreviewNotificationTemplateBody,
  PreviewNotificationTemplateResponse,
  SendTestNotificationTemplateBody,
  SendTestNotificationTemplateResponse,
  UpdateNotificationTemplateBody,
} from '@ethics/dto';
import {
  AdminActionCode,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  NOTIFICATION_TEMPLATE_CODE_VALUES,
  NotificationTemplateCode,
  containsSensitiveEmailContent,
  renderNotificationEmailTemplate,
  type NotificationTemplateCodeValue,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { EmailRelayService } from '../../integration/email/email-relay.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import {
  configsEqual,
  toNotificationTemplateConfigSnapshot,
  validateNotificationTemplateBody,
} from './notification-template.mapper.js';

const NOTIFICATION_TEMPLATE_ACTION = AdminActionCode.NOTIFICATION_TEMPLATE_CHANGE;

@Injectable()
export class NotificationTemplateAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(EmailRelayService) private readonly emailRelay: EmailRelayService,
  ) {}

  async listTemplates(): Promise<NotificationTemplateListItem[]> {
    const [templates, pendingItems] = await Promise.all([
      this.prisma.notificationTemplate.findMany({
        orderBy: { templateCode: 'asc' },
      }),
      this.prisma.notificationTemplateChangeItem.findMany({
        where: { batch: { status: 'PENDING' } },
        select: { templateCode: true, batchId: true },
      }),
    ]);

    const pendingBatchByCode = new Map(
      pendingItems.map((item) => [item.templateCode, item.batchId] as const),
    );

    return templates.map((template) => ({
      templateCode: template.templateCode as NotificationTemplateCodeValue,
      name: template.name,
      channel: template.channel,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      isActive: template.isActive,
      versionNo: template.versionNo,
      updatedAt: template.updatedAt.toISOString(),
      pendingBatchId: pendingBatchByCode.get(template.templateCode) ?? null,
    }));
  }

  async proposeChange(
    actor: AuthenticatedUser,
    templateCode: string,
    body: UpdateNotificationTemplateBody,
    correlationId: string,
  ): Promise<NotificationTemplateChangeProposal> {
    this.makerChecker.assertMaker(actor, NOTIFICATION_TEMPLATE_ACTION);

    if (
      !NOTIFICATION_TEMPLATE_CODE_VALUES.includes(templateCode as NotificationTemplateCodeValue)
    ) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND,
        'Bildirim şablonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const template = await this.prisma.notificationTemplate.findUnique({
      where: { templateCode },
    });

    if (!template) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND,
        'Bildirim şablonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const currentConfig = toNotificationTemplateConfigSnapshot(template);
    const proposedConfig: NotificationTemplateConfigSnapshot = {
      name: body.name ?? currentConfig.name,
      subjectTemplate:
        body.subjectTemplate !== undefined ? body.subjectTemplate : currentConfig.subjectTemplate,
      bodyTemplate: body.bodyTemplate ?? currentConfig.bodyTemplate,
      isActive: body.isActive ?? currentConfig.isActive,
    };

    const validationError = validateNotificationTemplateBody(proposedConfig.bodyTemplate);
    if (validationError) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_INVALID,
        validationError,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (containsSensitiveEmailContent(proposedConfig.bodyTemplate)) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_SENSITIVE_CONTENT,
        'Şablon gövdesi hassas alan adları içeremez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (configsEqual(currentConfig, proposedConfig)) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_UNCHANGED,
        'Yeni şablon konfigürasyonu mevcut değerle aynı.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pending = await this.prisma.notificationTemplateChangeItem.findFirst({
      where: {
        templateCode,
        batch: { status: 'PENDING' },
      },
    });

    if (pending) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_PENDING,
        'Bu şablon için zaten onay bekleyen bir değişiklik var.',
        HttpStatus.CONFLICT,
      );
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.notificationTemplateChangeBatch.create({
        data: {
          requestedBy: actor.id,
          reason: body.reason,
          items: {
            create: {
              templateCode,
              currentConfig: currentConfig,
              proposedConfig: proposedConfig,
            },
          },
        },
        include: { items: true },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'notification_template_change_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'notification_template_change_batch',
        resourceId: createdBatch.id,
        correlationId,
        idempotencyKey: `notification-template-request:${createdBatch.id}`,
        metadata: {
          batch_id: createdBatch.id,
          maker_user_id: actor.id,
          reason: body.reason,
          template_code: templateCode,
          old_config: currentConfig,
          new_config: proposedConfig,
        },
      });

      return createdBatch;
    });

    return this.toProposal(batch);
  }

  async approveBatch(
    checker: AuthenticatedUser,
    batchId: string,
    body: ApproveNotificationTemplateBatchBody,
    correlationId: string,
  ): Promise<ApproveNotificationTemplateBatchResponse> {
    const batch = await this.prisma.notificationTemplateChangeBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch || batch.status !== 'PENDING') {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_BATCH_NOT_FOUND,
        'Onay bekleyen şablon değişikliği bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(checker, batch.requestedBy, NOTIFICATION_TEMPLATE_ACTION);

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.notificationTemplateChangeBatch.update({
          where: { id: batch.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'notification_template_change_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'notification_template_change_batch',
          resourceId: batch.id,
          correlationId,
          idempotencyKey: `notification-template-reject:${batch.id}:${checker.id}`,
          metadata: {
            batch_id: batch.id,
            checker_user_id: checker.id,
            maker_user_id: batch.requestedBy,
            reason: body.reason,
            template_codes: batch.items.map((item) => item.templateCode),
          },
        });

        return updated;
      });

      return {
        batchId: rejected.id,
        status: 'REJECTED',
        appliedTemplateCodes: [],
      };
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const appliedTemplateCodes: NotificationTemplateCodeValue[] = [];

      for (const item of batch.items) {
        const template = await tx.notificationTemplate.findUnique({
          where: { templateCode: item.templateCode },
        });

        if (!template) {
          throw new DomainException(
            ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND,
            `Bildirim şablonu bulunamadı: ${item.templateCode}`,
            HttpStatus.NOT_FOUND,
          );
        }

        const proposedConfig = item.proposedConfig as NotificationTemplateConfigSnapshot;

        await tx.notificationTemplate.update({
          where: { templateCode: item.templateCode },
          data: {
            name: proposedConfig.name,
            subjectTemplate: proposedConfig.subjectTemplate,
            bodyTemplate: proposedConfig.bodyTemplate,
            isActive: proposedConfig.isActive,
            versionNo: { increment: 1 },
          },
        });

        appliedTemplateCodes.push(item.templateCode as NotificationTemplateCodeValue);

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'notification_template_changed',
          outcome: AuditOutcome.ALLOWED,
          resourceType: 'notification_template',
          resourceId: template.id,
          correlationId,
          idempotencyKey: `notification-template-apply:${batch.id}:${item.templateCode}`,
          metadata: {
            template_code: item.templateCode,
            version: template.versionNo + 1,
            old_config: item.currentConfig,
            new_config: item.proposedConfig,
            reason: body.reason,
            maker_user_id: batch.requestedBy,
            checker_user_id: checker.id,
            batch_id: batch.id,
          },
        });
      }

      const updatedBatch = await tx.notificationTemplateChangeBatch.update({
        where: { id: batch.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      return { updatedBatch, appliedTemplateCodes };
    });

    return {
      batchId: approved.updatedBatch.id,
      status: 'APPROVED',
      appliedTemplateCodes: approved.appliedTemplateCodes,
    };
  }

  async previewTemplate(
    templateCode: string,
    body: PreviewNotificationTemplateBody,
  ): Promise<PreviewNotificationTemplateResponse> {
    if (
      !NOTIFICATION_TEMPLATE_CODE_VALUES.includes(templateCode as NotificationTemplateCodeValue)
    ) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND,
        'Bildirim şablonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const template = await this.prisma.notificationTemplate.findUnique({
      where: { templateCode },
      select: { subjectTemplate: true },
    });

    if (!template) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND,
        'Bildirim şablonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (containsSensitiveEmailContent(body.bodyTemplate)) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_SENSITIVE_CONTENT,
        'Şablon gövdesi hassas alan adları içeremez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rendered = renderNotificationEmailTemplate({
      subjectTemplate: body.subjectTemplate ?? template.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
    });

    return rendered;
  }

  async sendTestEmail(
    actor: AuthenticatedUser,
    templateCode: string,
    body: SendTestNotificationTemplateBody,
    correlationId: string,
  ): Promise<SendTestNotificationTemplateResponse> {
    if (
      !NOTIFICATION_TEMPLATE_CODE_VALUES.includes(templateCode as NotificationTemplateCodeValue)
    ) {
      throw new DomainException(
        ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND,
        'Bildirim şablonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (templateCode === NotificationTemplateCode.SECURE_MESSAGE_REPORTER) {
      throw new DomainException(
        ErrorCode.NOTIFICATION_EMAIL_NOT_ALLOWED,
        'Anonim bildirimci kanalı için e-posta gönderilemez.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!this.emailRelay.isConfigured()) {
      throw new DomainException(
        ErrorCode.NOTIFICATION_EMAIL_NOT_CONFIGURED,
        'SMTP yapılandırması bulunamadı; test e-postası gönderilemez.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const rendered = await this.previewTemplate(templateCode, body);
    const result = await this.emailRelay.sendEmail({
      to: body.recipientEmail,
      subject: `[TEST] ${rendered.subject}`,
      textBody: rendered.textBody,
      htmlBody: rendered.htmlBody,
      correlationId,
    });

    await this.prisma.$transaction(async (tx) => {
      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'notification_template_test_sent',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'notification_template',
        resourceId: templateCode,
        correlationId,
        idempotencyKey: `notification-template-test:${templateCode}:${correlationId}`,
        metadata: {
          template_code: templateCode,
          recipient_email_domain: body.recipientEmail.split('@')[1] ?? '[unknown]',
        },
      });
    });

    return {
      messageId: result.messageId,
      recipientEmail: body.recipientEmail,
    };
  }

  private toProposal(
    batch: Prisma.NotificationTemplateChangeBatchGetPayload<{ include: { items: true } }>,
  ): NotificationTemplateChangeProposal {
    return {
      batchId: batch.id,
      status: batch.status as NotificationTemplateChangeProposal['status'],
      reason: batch.reason,
      requestedBy: batch.requestedBy,
      requestedAt: batch.createdAt.toISOString(),
      items: batch.items.map((item) => ({
        templateCode: item.templateCode as NotificationTemplateCodeValue,
        currentConfig: item.currentConfig as NotificationTemplateConfigSnapshot,
        proposedConfig: item.proposedConfig as NotificationTemplateConfigSnapshot,
      })),
    };
  }
}
