import { randomBytes, randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { InitiateAttachmentBody, InitiateAttachmentResponse } from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  MalwareScanStatus,
} from '@ethics/shared';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import { KEY_MANAGEMENT_PORT, CRYPTO_DEK_LENGTH_BYTES } from '../../crypto/crypto.constants.js';
import type { KeyManagementPort } from '../../crypto/key-management.port.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OBJECT_STORAGE_PORT, type ObjectStoragePort } from '../../storage/object-storage.port.js';
import {
  assertAllowedUploadMetadata,
  assertTotalAttachmentSize,
  buildQuarantineStorageKey,
} from './file-upload.validation.js';

const REPORTER_UPLOADED_BY = 'reporter';

export type InitiateAttachmentCommand = {
  trackingCode: string;
  body: InitiateAttachmentBody;
  correlationId: string;
  auditEventType:
    | typeof AuditEventType.REPORT_ATTACHMENT_UPLOADED
    | typeof AuditEventType.TRACKING_ATTACHMENT_UPLOADED;
  auditAction: string;
};

@Injectable()
export class ReportAttachmentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CryptoService) private readonly cryptoService: CryptoService,
    @Inject(KEY_MANAGEMENT_PORT) private readonly keyManagement: KeyManagementPort,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
  ) {}

  async initiateUpload(command: InitiateAttachmentCommand): Promise<InitiateAttachmentResponse> {
    const { trackingCode, body, correlationId, auditEventType, auditAction } = command;

    assertAllowedUploadMetadata(body);

    const report = await this.prisma.report.findUnique({
      where: { trackingCode },
      select: { id: true, companyId: true },
    });

    if (!report) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bildirim bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const aggregate = await this.prisma.reportAttachment.aggregate({
      where: { reportId: report.id },
      _sum: { fileSizeBytes: true },
    });

    assertTotalAttachmentSize(aggregate._sum.fileSizeBytes ?? 0n, body.sizeBytes);

    const attachmentId = randomUUID();
    const storageKey = buildQuarantineStorageKey(report.id, attachmentId);
    const encryptedFilename = await this.cryptoService.encryptField(
      body.originalFilename,
      'original_filename',
      attachmentId,
    );
    const documentDek = randomBytes(CRYPTO_DEK_LENGTH_BYTES);
    const wrappedDocumentDek = await this.keyManagement.wrapKey(documentDek, 'document');
    const presigned = await this.objectStorage.createPresignedPutUrl({
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    const uploadedAt = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const attachment = await tx.reportAttachment.create({
        data: {
          id: attachmentId,
          reportId: report.id,
          originalFilename: encryptedFilename.ciphertext,
          storageKey,
          encryptedDek: wrappedDocumentDek.encryptedDek,
          kmsKeyId: wrappedDocumentDek.kmsKeyId,
          contentSha256: body.contentSha256.toLowerCase(),
          fileSizeBytes: BigInt(body.sizeBytes),
          mimeType: body.mimeType,
          malwareScanStatus: MalwareScanStatus.PENDING,
          uploadedAt,
          uploadedBy: REPORTER_UPLOADED_BY,
        },
        select: {
          id: true,
          mimeType: true,
          fileSizeBytes: true,
          malwareScanStatus: true,
          uploadedAt: true,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: auditEventType,
        actorType: AuditActorType.SYSTEM,
        action: auditAction,
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'report_attachment',
        resourceId: attachment.id,
        companyId: report.companyId,
        correlationId,
        metadata: {
          reportId: report.id,
          fileSize: body.sizeBytes,
          mimeType: body.mimeType,
          malwareScanStatus: MalwareScanStatus.PENDING,
        },
        idempotencyKey: `${auditAction}:${attachment.id}`,
      });

      await tx.report.update({
        where: { id: report.id },
        data: { lastActivityAt: uploadedAt },
      });

      return attachment;
    });

    return {
      id: created.id,
      originalFilename: body.originalFilename,
      sizeBytes: body.sizeBytes,
      mimeType: created.mimeType,
      malwareScanStatus: MalwareScanStatus.PENDING,
      uploadUrl: presigned.uploadUrl,
      uploadUrlExpiresAt: presigned.expiresAt.toISOString(),
      uploadedAt: created.uploadedAt.toISOString(),
    };
  }
}
