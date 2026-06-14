import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { SendSecureMessageBody } from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  SECURE_MESSAGE_SENDER_LABELS,
  SecureMessageApiDirection,
  SecureMessageDirection,
  SecureMessageSenderType,
  toSecureMessageApiDirection,
} from '@ethics/shared';
import { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { NotificationService } from '../../notification/notification.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import { CRYPTO_ALGORITHM } from '../../crypto/crypto.constants.js';
import type { EncryptedFieldResult } from '../../crypto/crypto.types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  buildEncryptionMetadataEntry,
  type FieldEncryptionMetadataEntry,
} from '../intake/intake.types.js';
import type { TrackingReportContext } from './tracking.types.js';

type SecureMessageEncryptionMetadata = Record<string, FieldEncryptionMetadataEntry>;

type SecureMessageRow = {
  id: string;
  direction: string;
  messageBody: string;
  encryptionMetadata: Prisma.JsonValue;
  isRead: boolean;
  createdAt: Date;
};

export type SecureMessageListItem = {
  id: string;
  direction: typeof SecureMessageApiDirection.INBOUND | typeof SecureMessageApiDirection.OUTBOUND;
  senderLabel: string;
  bodyText: string;
  sentAt: string;
  isRead: boolean;
};

export type SendSecureMessageResult = {
  id: string;
  sentAt: string;
};

@Injectable()
export class SecureMessageService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CryptoService) private readonly cryptoService: CryptoService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(NotificationService) private readonly notificationService: NotificationService,
  ) {}

  async hasUnreadInboundMessages(reportId: string): Promise<boolean> {
    const unreadCount = await this.prisma.secureMessage.count({
      where: {
        reportId,
        direction: SecureMessageDirection.OUTBOUND_TO_REPORTER,
        isRead: false,
      },
    });

    return unreadCount > 0;
  }

  async listMessages(
    reportContext: TrackingReportContext,
    correlationId: string,
  ): Promise<SecureMessageListItem[]> {
    const messages = await this.prisma.secureMessage.findMany({
      where: { reportId: reportContext.reportId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        direction: true,
        messageBody: true,
        encryptionMetadata: true,
        isRead: true,
        createdAt: true,
      },
    });

    const decryptedMessages = await Promise.all(
      messages.map(async (message) => this.toListItem(message, reportContext.reportId)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.secureMessage.updateMany({
        where: {
          reportId: reportContext.reportId,
          direction: SecureMessageDirection.OUTBOUND_TO_REPORTER,
          isRead: false,
        },
        data: { isRead: true },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.SECURE_MESSAGE_READ,
        actorType: AuditActorType.ANONYMOUS,
        action: 'secure_message_read',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'report',
        resourceId: reportContext.reportId,
        companyId: reportContext.companyId,
        correlationId,
        metadata: {
          message_count: messages.length,
        },
        idempotencyKey: `secure-message-read:${correlationId}`,
      });
    });

    return decryptedMessages.map((message) =>
      message.direction === SecureMessageApiDirection.INBOUND
        ? { ...message, isRead: true }
        : message,
    );
  }

  async sendMessage(
    reportContext: TrackingReportContext,
    body: SendSecureMessageBody,
    correlationId: string,
  ): Promise<SendSecureMessageResult> {
    const messageId = randomUUID();
    const encrypted = await this.encryptMessageBody(messageId, body.bodyText);
    const sentAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.secureMessage.create({
        data: {
          id: messageId,
          reportId: reportContext.reportId,
          direction: SecureMessageDirection.INBOUND_FROM_REPORTER,
          senderType: SecureMessageSenderType.ANONYMOUS_REPORTER,
          senderUserId: null,
          messageBody: encrypted.ciphertext,
          attachmentsMetadata: null,
          encryptionMetadata: encrypted.metadata as unknown as Prisma.InputJsonValue,
          isRead: true,
          createdAt: sentAt,
        },
      });

      await tx.report.update({
        where: { id: reportContext.reportId },
        data: { lastActivityAt: sentAt },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.SECURE_MESSAGE_SENT,
        actorType: AuditActorType.ANONYMOUS,
        action: 'secure_message_sent',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'secure_message',
        resourceId: messageId,
        companyId: reportContext.companyId,
        correlationId,
        metadata: {
          report_id: reportContext.reportId,
          direction: SecureMessageApiDirection.OUTBOUND,
          message_id: messageId,
        },
        idempotencyKey: `secure-message-sent:${messageId}`,
      });

      const linkedCase = await tx.case.findUnique({
        where: { reportId: reportContext.reportId },
        select: { id: true },
      });

      if (linkedCase) {
        await this.notificationService.enqueueSecureMessageReceived(tx, {
          caseId: linkedCase.id,
          reportId: reportContext.reportId,
          messageId,
          trackingCode: reportContext.trackingCode,
          correlationId,
          idempotencyKey: messageId,
        });
      }
    });

    return {
      id: messageId,
      sentAt: sentAt.toISOString(),
    };
  }

  private async encryptMessageBody(
    messageId: string,
    plaintext: string,
  ): Promise<{ ciphertext: string; metadata: SecureMessageEncryptionMetadata }> {
    const encrypted = await this.cryptoService.encryptField(plaintext, 'message_body', messageId);

    return {
      ciphertext: encrypted.ciphertext,
      metadata: {
        message_body: buildEncryptionMetadataEntry(encrypted),
      },
    };
  }

  private async toListItem(
    message: SecureMessageRow,
    reportId: string,
  ): Promise<SecureMessageListItem> {
    const apiDirection = toSecureMessageApiDirection(
      message.direction as typeof SecureMessageDirection.INBOUND_FROM_REPORTER,
    );
    const bodyText = await this.decryptMessageBody(message, reportId);

    return {
      id: message.id,
      direction: apiDirection,
      senderLabel: SECURE_MESSAGE_SENDER_LABELS[apiDirection],
      bodyText,
      sentAt: message.createdAt.toISOString(),
      isRead: message.isRead,
    };
  }

  private async decryptMessageBody(message: SecureMessageRow, reportId: string): Promise<string> {
    const metadata = message.encryptionMetadata as unknown as SecureMessageEncryptionMetadata;
    const fieldMeta = metadata.message_body;

    if (!fieldMeta) {
      throw new DomainException(
        ErrorCode.CRYPTO_DECRYPT_FAILED,
        'Mesaj şifreleme metadata bulunamadı.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const encrypted: EncryptedFieldResult = {
      ciphertext: message.messageBody,
      encryptedDek: fieldMeta.encryptedDek,
      kmsKeyId: fieldMeta.kmsKeyId,
      algorithm: fieldMeta.algorithm as typeof CRYPTO_ALGORITHM,
    };

    return this.cryptoService.decryptField(encrypted, 'message_body', reportId);
  }
}
