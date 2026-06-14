import { createHash, randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CaseDocumentListItem,
  CompleteCaseDocumentUploadResponse,
  DocumentDownloadResponse,
  InitiateCaseDocumentBody,
  InitiateCaseDocumentResponse,
} from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ClearanceLevel,
  DocumentGrantScope,
  DocumentStatus,
  ErrorCode,
  MalwareScanStatus,
  PRESIGNED_DOWNLOAD_TTL_SECONDS,
} from '@ethics/shared';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { DocumentPolicyService } from '../../authorization/document-policy.service.js';
import { PolicyScopeService } from '../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { CRYPTO_ALGORITHM } from '../../crypto/crypto.constants.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OBJECT_STORAGE_PORT, type ObjectStoragePort } from '../../storage/object-storage.port.js';
import { assertAllowedUploadMetadata } from '../intake/file-upload.validation.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentEnvelopeService } from './document-envelope.service.js';
import {
  assertTotalCaseDocumentSize,
  buildCaseDocumentStorageKey,
} from './file-upload.validation.js';

const INITIAL_VERSION_NO = 1;

@Injectable()
export class DocumentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyScopeService) private readonly policyScope: PolicyScopeService,
    @Inject(DocumentPolicyService) private readonly documentPolicy: DocumentPolicyService,
    @Inject(CryptoService) private readonly cryptoService: CryptoService,
    @Inject(DocumentEnvelopeService) private readonly envelopeService: DocumentEnvelopeService,
    @Inject(DocumentAccessService) private readonly documentAccess: DocumentAccessService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
  ) {}

  async listCaseDocuments(
    user: AuthenticatedUser,
    caseId: string,
  ): Promise<CaseDocumentListItem[]> {
    await this.findAccessibleCase(user, caseId);

    const documents = await this.prisma.document.findMany({
      where: { caseId },
      include: {
        uploadedBy: { select: { displayName: true, email: true } },
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: { malwareScanStatus: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const visible: CaseDocumentListItem[] = [];

    for (const document of documents) {
      const accessResult = await this.documentPolicy.canAccessDocument(user, document.id, {
        caseId: document.caseId,
        documentCategory: document.documentCategory,
        resourceClearanceLevel: document.confidentialityLevel as ClearanceLevel,
        requiredGrantScope: DocumentGrantScope.METADATA_ONLY,
      });

      if (!accessResult.allowed) {
        continue;
      }

      const downloadResult = await this.documentPolicy.canAccessDocument(user, document.id, {
        caseId: document.caseId,
        documentCategory: document.documentCategory,
        resourceClearanceLevel: document.confidentialityLevel as ClearanceLevel,
        requiredGrantScope: DocumentGrantScope.FULL_ACCESS,
      });

      const currentVersion = document.versions[0];
      const malwareScanStatus = currentVersion?.malwareScanStatus ?? MalwareScanStatus.PENDING;

      const canDownload =
        downloadResult.allowed &&
        document.status === DocumentStatus.AVAILABLE &&
        document.contentSealedAt !== null &&
        malwareScanStatus === MalwareScanStatus.CLEAN;

      visible.push({
        id: document.id,
        documentCategory: document.documentCategory,
        title: document.title,
        currentVersionNo: document.currentVersionNo,
        status: document.status,
        malwareScanStatus,
        confidentialityLevel: document.confidentialityLevel,
        uploadedAt: document.uploadedAt.toISOString(),
        uploadedByDisplayName:
          document.uploadedBy?.displayName ?? document.uploadedBy?.email ?? null,
        canDownload,
      });
    }

    return visible;
  }

  async initiateCaseDocumentUpload(
    user: AuthenticatedUser,
    caseId: string,
    body: InitiateCaseDocumentBody,
    correlationId: string,
  ): Promise<InitiateCaseDocumentResponse> {
    assertAllowedUploadMetadata(body);

    const caseEntity = await this.findAccessibleCase(user, caseId);
    await this.assertOptionalTaskBelongsToCase(caseId, body.taskId);

    const aggregate = await this.prisma.documentVersion.aggregate({
      where: { document: { caseId } },
      _sum: { sizeBytes: true },
    });
    assertTotalCaseDocumentSize(aggregate._sum.sizeBytes ?? 0n, body.sizeBytes);

    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageKey = buildCaseDocumentStorageKey(caseId, documentId, INITIAL_VERSION_NO);
    const wrappedDocumentDek = await this.cryptoService.generateWrappedDocumentDek();
    const encryptionMetadata = this.envelopeService.buildEncryptionMetadata(
      wrappedDocumentDek.encryptedDek,
      wrappedDocumentDek.kmsKeyId,
    );
    const sealedStorageKey = await this.envelopeService.sealString(storageKey, encryptionMetadata);
    const sealedFilename = await this.envelopeService.sealString(
      body.originalFilename,
      encryptionMetadata,
    );

    const presigned = await this.objectStorage.createPresignedPutUrl({
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    const uploadedAt = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          id: documentId,
          caseId,
          reportId: caseEntity.reportId,
          taskId: body.taskId ?? null,
          documentCategory: body.documentCategory,
          title: body.title,
          currentVersionNo: INITIAL_VERSION_NO,
          status: DocumentStatus.QUARANTINED,
          confidentialityLevel: caseEntity.confidentialityLevel,
          uploadedByUserId: user.id,
          uploadedAt,
          versions: {
            create: {
              id: versionId,
              versionNo: INITIAL_VERSION_NO,
              storageKeyCiphertext: sealedStorageKey,
              encryptedDek: wrappedDocumentDek.encryptedDek,
              kmsKeyId: wrappedDocumentDek.kmsKeyId,
              encryptionAlgorithm: CRYPTO_ALGORITHM,
              contentSha256: body.contentSha256.toLowerCase(),
              sizeBytes: BigInt(body.sizeBytes),
              mimeType: body.mimeType,
              originalFilenameEncrypted: sealedFilename,
              malwareScanStatus: MalwareScanStatus.PENDING,
              uploadedByUserId: user.id,
            },
          },
        },
        select: {
          id: true,
          currentVersionNo: true,
          status: true,
          uploadedAt: true,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.DOCUMENT_UPLOADED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'document_uploaded',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'document',
        resourceId: document.id,
        caseId,
        companyId: caseEntity.companyId,
        correlationId,
        metadata: {
          documentId: document.id,
          caseId,
          documentCategory: body.documentCategory,
          sizeBytes: body.sizeBytes,
          mimeType: body.mimeType,
          uploaderUserId: user.id,
          malwareScanStatus: MalwareScanStatus.PENDING,
        },
        idempotencyKey: `document_uploaded:${document.id}`,
      });

      await this.documentAccess.grantUploaderAccess(tx, document.id, user.id);

      return document;
    });

    return {
      id: created.id,
      versionNo: created.currentVersionNo,
      status: created.status as InitiateCaseDocumentResponse['status'],
      malwareScanStatus: MalwareScanStatus.PENDING,
      uploadUrl: presigned.uploadUrl,
      uploadUrlExpiresAt: presigned.expiresAt.toISOString(),
      uploadedAt: created.uploadedAt.toISOString(),
    };
  }

  /**
   * Client presigned PUT sonrası çağrılır: plaintext blob envelope ile şifrelenir, storage'da yalnızca ciphertext kalır.
   */
  async completeCaseDocumentUpload(
    user: AuthenticatedUser,
    caseId: string,
    documentId: string,
    correlationId: string,
  ): Promise<CompleteCaseDocumentUploadResponse> {
    const caseEntity = await this.findAccessibleCase(user, caseId);

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, caseId },
    });

    if (!document) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Doküman bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (document.contentSealedAt) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Doküman içeriği zaten mühürlenmiş.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const version = await this.prisma.documentVersion.findFirst({
      where: { documentId, versionNo: document.currentVersionNo },
    });

    if (!version) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Doküman versiyonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const encryptionMetadata = this.envelopeService.buildEncryptionMetadata(
      version.encryptedDek,
      version.kmsKeyId,
      version.encryptionAlgorithm,
    );
    const storageKey = await this.envelopeService.openString(
      version.storageKeyCiphertext,
      encryptionMetadata,
    );

    let plaintext: Buffer;
    try {
      plaintext = await this.objectStorage.getObjectBuffer(storageKey);
    } catch {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Yüklenen dosya bulunamadı. Önce presigned URL ile yükleme yapınız.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const computedSha256 = createHash('sha256').update(plaintext).digest('hex');
    if (computedSha256 !== version.contentSha256.toLowerCase()) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Dosya bütünlük doğrulaması başarısız.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const sealedContent = await this.cryptoService.sealDocumentContent(
      plaintext,
      encryptionMetadata,
    );

    await this.objectStorage.putObject({
      storageKey,
      content: sealedContent,
      contentType: 'application/octet-stream',
    });

    const sealedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { contentSealedAt: sealedAt },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.DOCUMENT_UPLOADED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'document_content_sealed',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'document',
        resourceId: documentId,
        caseId,
        companyId: caseEntity.companyId,
        correlationId,
        metadata: {
          documentId,
          caseId,
          versionNo: version.versionNo,
          contentSealed: true,
        },
        idempotencyKey: `document_content_sealed:${documentId}:v${String(version.versionNo)}`,
      });
    });

    return {
      id: documentId,
      versionNo: version.versionNo,
      contentSealedAt: sealedAt.toISOString(),
    };
  }

  /**
   * Şifreli blob'u açar, kısa ömürlü presigned GET URL döner.
   * Grant + clearance DocumentPolicyService ile doğrulanır.
   */
  async getDocumentDownloadUrl(
    user: AuthenticatedUser,
    documentId: string,
    correlationId: string,
  ): Promise<DocumentDownloadResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: { select: { id: true, companyId: true } },
      },
    });

    if (!document) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Doküman bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const caseScope = this.policyScope.buildCaseScope(user) as Prisma.CaseWhereInput;
    const accessibleCase = await this.prisma.case.findFirst({
      where: {
        AND: [{ id: document.caseId }, caseScope],
      },
      select: { id: true },
    });

    if (!accessibleCase) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Doküman bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.documentPolicy.assertDocumentAccess(user, documentId, {
      caseId: document.caseId,
      documentCategory: document.documentCategory,
      resourceClearanceLevel: document.confidentialityLevel as ClearanceLevel,
      requiredGrantScope: DocumentGrantScope.FULL_ACCESS,
    });

    if (!document.contentSealedAt) {
      throw new DomainException(
        ErrorCode.DOCUMENT_QUARANTINED,
        'Doküman içeriği henüz hazır değil.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (document.status !== DocumentStatus.AVAILABLE) {
      if (document.status === DocumentStatus.REJECTED) {
        throw new DomainException(
          ErrorCode.DOCUMENT_REJECTED,
          'Doküman reddedildi.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      throw new DomainException(
        ErrorCode.DOCUMENT_QUARANTINED,
        'Dosya henüz taranıyor.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const version = await this.prisma.documentVersion.findFirst({
      where: { documentId, versionNo: document.currentVersionNo },
    });

    if (!version) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Doküman versiyonu bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (version.malwareScanStatus !== MalwareScanStatus.CLEAN) {
      if (version.malwareScanStatus === MalwareScanStatus.REJECTED) {
        throw new DomainException(
          ErrorCode.DOCUMENT_REJECTED,
          'Doküman güvenlik taramasını geçemedi.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      throw new DomainException(
        ErrorCode.DOCUMENT_QUARANTINED,
        'Dosya henüz taranıyor.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const encryptionMetadata = this.envelopeService.buildEncryptionMetadata(
      version.encryptedDek,
      version.kmsKeyId,
      version.encryptionAlgorithm,
    );
    const storageKey = await this.envelopeService.openString(
      version.storageKeyCiphertext,
      encryptionMetadata,
    );

    const encryptedPayload = await this.objectStorage.getObjectBuffer(storageKey);
    const plaintext = await this.cryptoService.openDocumentContent(
      encryptedPayload,
      encryptionMetadata,
    );
    const originalFilename = await this.envelopeService.openString(
      version.originalFilenameEncrypted,
      encryptionMetadata,
    );

    const downloadCacheKey = this.envelopeService.buildDownloadCacheKey(
      documentId,
      version.versionNo,
    );
    await this.objectStorage.putObject({
      storageKey: downloadCacheKey,
      content: plaintext,
      contentType: version.mimeType,
    });

    const presigned = await this.objectStorage.createPresignedGetUrl({
      storageKey: downloadCacheKey,
      expiresInSeconds: PRESIGNED_DOWNLOAD_TTL_SECONDS,
      downloadFilename: originalFilename,
      contentType: version.mimeType,
    });

    await this.prisma.$transaction(async (tx) => {
      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.DOCUMENT_DOWNLOADED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'document_downloaded',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'document',
        resourceId: documentId,
        caseId: document.caseId,
        companyId: document.case.companyId,
        correlationId,
        metadata: {
          documentId,
          versionNo: version.versionNo,
          caseId: document.caseId,
          signedUrlTtlSeconds: PRESIGNED_DOWNLOAD_TTL_SECONDS,
        },
        idempotencyKey: `document_downloaded:${documentId}:v${String(version.versionNo)}:${correlationId}`,
      });
    });

    return {
      downloadUrl: presigned.downloadUrl,
      expiresAt: presigned.expiresAt.toISOString(),
      filename: originalFilename,
    };
  }

  private async findAccessibleCase(
    user: AuthenticatedUser,
    caseId: string,
  ): Promise<{ id: string; reportId: string; companyId: string; confidentialityLevel: string }> {
    const scope = this.policyScope.buildCaseScope(user) as Prisma.CaseWhereInput;
    const caseEntity = await this.prisma.case.findFirst({
      where: {
        AND: [{ id: caseId }, scope],
      },
      select: {
        id: true,
        reportId: true,
        companyId: true,
        confidentialityLevel: true,
      },
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    return caseEntity;
  }

  private async assertOptionalTaskBelongsToCase(caseId: string, taskId?: string): Promise<void> {
    if (!taskId) {
      return;
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, caseId },
      select: { id: true },
    });

    if (!task) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Görev bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
