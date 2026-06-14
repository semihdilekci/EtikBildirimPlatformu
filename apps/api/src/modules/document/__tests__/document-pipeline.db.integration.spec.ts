import { createHash, randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  DocumentCategory,
  DocumentStatus,
  ErrorCode,
  MalwareScanStatus,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  WORKFLOW_VERSION,
  WorkflowCommand,
  AuditActorType,
  CaseState,
  Role,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedRoleTestUsers, seedSyntheticCompany } from '@ethics/test-fixtures';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import {
  createDocumentServiceForTests,
  extractLocalStorageDownloadKey,
  TEST_DOCUMENT_KEK,
} from './document-service.test-factory.js';
import {
  createMalwareScanJobRunner,
  EICAR_TEST_SIGNATURE,
  type MalwareScanJobRunner,
} from './malware-scan-test.harness.js';
import { buildCaseDocumentStorageKey } from '../file-upload.validation.js';
import type { DocumentService } from '../document.service.js';
import type { LocalObjectStorageAdapter } from '../../../storage/local-object-storage.adapter.js';

function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * E2E journey: presigned upload → seal → async ClamAV worker → AVAILABLE → download.
 * Docs/10 Faz 7 İterasyon 6 — tam pipeline entegrasyonu.
 */
describe('Document upload → scan → download pipeline E2E (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: DocumentService;
  let storage: LocalObjectStorageAdapter;
  let secretaryUser: AuthenticatedUser;
  let caseId: string;

  let scanJobRunner: MalwareScanJobRunner;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    const companyId = await seedSyntheticCompany(environment.prisma);
    await seedRoleTestUsers(environment.prisma);

    const userRecord = await environment.prisma.user.findUniqueOrThrow({
      where: { email: 'council.secretary@ethics.local' },
      include: {
        rolesAssigned: { where: { isActive: true } },
        company: true,
      },
    });

    secretaryUser = {
      id: userRecord.id,
      email: userRecord.email,
      displayName: userRecord.displayName,
      companyId: userRecord.companyId,
      companyName: userRecord.company?.name ?? null,
      locationId: userRecord.locationId,
      functionId: userRecord.functionId,
      clearanceLevel: userRecord.clearanceLevel as AuthenticatedUser['clearanceLevel'],
      isGeneralSecretary: userRecord.isGeneralSecretary,
      roles: userRecord.rolesAssigned.map((role) => role.roleCode as Role),
    };

    const reportId = randomUUID();
    caseId = randomUUID();

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-PIPELINE1',
        trackingCodePasswordHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$hash',
        incidentCountry: 'TUR',
        incidentCity: 'İstanbul',
        companyId,
        categoryGroup: ReportCategoryGroup.ASSET_FINANCIAL,
        categories: [ReportSubCategory.EMBEZZLEMENT],
        incidentDescription: 'ciphertext-placeholder',
        encryptionMetadata: {},
        status: ReportStatus.SUBMITTED,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        channel: ReportChannel.WEB_FORM,
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    await environment.prisma.case.create({
      data: {
        id: caseId,
        reportId,
        currentState: CaseState.REPORT_SUBMITTED,
        workflowVersion: WORKFLOW_VERSION,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        companyId,
        createdBy: secretaryUser.id,
        transitions: {
          create: {
            fromState: CaseState.REPORT_SUBMITTED,
            toState: CaseState.REPORT_SUBMITTED,
            command: WorkflowCommand.OPEN_CASE,
            actorType: AuditActorType.SYSTEM,
            idempotencyKey: `open-case-${caseId}`,
          },
        },
      },
    });

    await environment.prisma.report.update({
      where: { id: reportId },
      data: { caseId },
    });

    const ctx = createDocumentServiceForTests(environment.prisma as never);
    service = ctx.service;
    storage = ctx.storage;

    scanJobRunner = await createMalwareScanJobRunner(
      environment.prisma,
      storage,
      TEST_DOCUMENT_KEK,
    );
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('upload → quarantine → worker scan → AVAILABLE → presigned download roundtrip', async () => {
    const fileContent = Buffer.from('Faz 7 tam pipeline entegrasyon içeriği');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'pipeline-test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.RAPPORTEUR_REPORT,
        title: 'Pipeline Test',
      },
      randomUUID(),
    );

    expect(initiated.status).toBe(DocumentStatus.QUARANTINED);
    expect(initiated.malwareScanStatus).toBe(MalwareScanStatus.PENDING);

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    const beforeScan = await environment.prisma.document.findUniqueOrThrow({
      where: { id: initiated.id },
    });
    expect(beforeScan.status).toBe(DocumentStatus.QUARANTINED);
    expect(beforeScan.contentSealedAt).not.toBeNull();

    const scanResult = await scanJobRunner.processPendingBatch();
    expect(scanResult.clean).toBeGreaterThanOrEqual(1);

    const afterScan = await environment.prisma.document.findUniqueOrThrow({
      where: { id: initiated.id },
      include: { versions: true },
    });
    expect(afterScan.status).toBe(DocumentStatus.AVAILABLE);
    expect(afterScan.versions[0]?.malwareScanStatus).toBe(MalwareScanStatus.CLEAN);

    const list = await service.listCaseDocuments(secretaryUser, caseId);
    const listed = list.find((item) => item.id === initiated.id);
    expect(listed?.canDownload).toBe(true);

    const download = await service.getDocumentDownloadUrl(
      secretaryUser,
      initiated.id,
      randomUUID(),
    );
    expect(download.filename).toBe('pipeline-test.pdf');

    const cacheKey = extractLocalStorageDownloadKey(download.downloadUrl);
    const downloaded = await storage.getObjectBuffer(cacheKey);
    expect(downloaded).toEqual(fileContent);
  });

  it('EICAR imzalı dosya worker scan sonrası REJECTED — indirme engellenir', async () => {
    const fileContent = Buffer.from(EICAR_TEST_SIGNATURE);
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'eicar.txt',
        mimeType: 'text/plain',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'EICAR Test',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());
    await scanJobRunner.processPendingBatch();

    const document = await environment.prisma.document.findUniqueOrThrow({
      where: { id: initiated.id },
    });
    expect(document.status).toBe(DocumentStatus.REJECTED);

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.DOCUMENT_REJECTED });
  });

  it('document_versions append-only — v2 eklendiğinde v1 korunur ve download v2 içeriğini döner', async () => {
    const v1Content = Buffer.from('versiyon 1 içeriği');
    const v2Content = Buffer.from('versiyon 2 güncellenmiş içeriği');

    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'versiyonlu.pdf',
        mimeType: 'application/pdf',
        sizeBytes: v1Content.length,
        contentSha256: sha256Hex(v1Content),
        documentCategory: DocumentCategory.DECISION_DRAFT,
        title: 'Versiyonlu Doküman',
      },
      randomUUID(),
    );

    const v1StorageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(v1StorageKey, v1Content);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());
    await scanJobRunner.processPendingBatch();

    const ctx = createDocumentServiceForTests(environment.prisma as never);
    const v1Version = await environment.prisma.documentVersion.findFirstOrThrow({
      where: { documentId: initiated.id, versionNo: 1 },
    });

    const wrappedDek = await ctx.cryptoService.generateWrappedDocumentDek();
    const metadata = ctx.envelopeService.buildEncryptionMetadata(
      wrappedDek.encryptedDek,
      wrappedDek.kmsKeyId,
    );
    const v2StorageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 2);
    const sealedV2Key = await ctx.envelopeService.sealString(v2StorageKey, metadata);
    const sealedV2Filename = await ctx.envelopeService.sealString('versiyonlu-v2.pdf', metadata);
    const sealedV2Content = await ctx.cryptoService.sealDocumentContent(v2Content, metadata);
    await storage.putObject({ storageKey: v2StorageKey, content: sealedV2Content });

    const version2Id = randomUUID();
    await environment.prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: {
          id: version2Id,
          documentId: initiated.id,
          versionNo: 2,
          storageKeyCiphertext: sealedV2Key,
          encryptedDek: wrappedDek.encryptedDek,
          kmsKeyId: wrappedDek.kmsKeyId,
          encryptionAlgorithm: 'AES-256-GCM',
          contentSha256: sha256Hex(v2Content),
          sizeBytes: BigInt(v2Content.length),
          mimeType: 'application/pdf',
          originalFilenameEncrypted: sealedV2Filename,
          malwareScanStatus: MalwareScanStatus.CLEAN,
          scannedAt: new Date(),
          uploadedByUserId: secretaryUser.id,
        },
      });
      await tx.document.update({
        where: { id: initiated.id },
        data: { currentVersionNo: 2, status: DocumentStatus.AVAILABLE },
      });
    });

    const versions = await environment.prisma.documentVersion.findMany({
      where: { documentId: initiated.id },
      orderBy: { versionNo: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.id).toBe(v1Version.id);
    expect(versions[1]?.versionNo).toBe(2);

    const download = await service.getDocumentDownloadUrl(
      secretaryUser,
      initiated.id,
      randomUUID(),
    );
    expect(download.filename).toBe('versiyonlu-v2.pdf');

    const cacheKey = extractLocalStorageDownloadKey(download.downloadUrl);
    const downloaded = await storage.getObjectBuffer(cacheKey);
    expect(downloaded).toEqual(v2Content);
  });
});
