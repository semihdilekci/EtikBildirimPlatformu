import { createHash, randomUUID } from 'node:crypto';

import {
  AuditEventType,
  ClearanceLevel,
  DocumentCategory,
  DocumentGrantScope,
  DocumentStatus,
  ErrorCode,
  MalwareScanStatus,
  PRESIGNED_DOWNLOAD_TTL_SECONDS,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  WORKFLOW_VERSION,
  WorkflowCommand,
  AuditActorType,
  CaseState,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { DocumentPolicyService } from '../../../authorization/document-policy.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { LocalObjectStorageAdapter } from '../../../storage/local-object-storage.adapter.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { seedRoleTestUsers, seedSyntheticCompany } from '@ethics/test-fixtures';
import { DocumentEnvelopeService } from '../document-envelope.service.js';
import { DocumentAccessService } from '../document-access.service.js';
import { DocumentService } from '../document.service.js';
import { buildCaseDocumentStorageKey } from '../file-upload.validation.js';
import { extractLocalStorageDownloadKey } from './document-service.test-factory.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');

function buildEnvService(): EnvService {
  return {
    isProduction: false,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
  } as EnvService;
}

function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

async function simulateMalwareScanResult(
  prisma: PostgresTestEnvironment['prisma'],
  documentId: string,
  result: 'clean' | 'rejected',
): Promise<void> {
  const scanStatus = result === 'clean' ? MalwareScanStatus.CLEAN : MalwareScanStatus.REJECTED;
  const documentStatus = result === 'clean' ? DocumentStatus.AVAILABLE : DocumentStatus.REJECTED;

  await prisma.document.update({
    where: { id: documentId },
    data: { status: documentStatus },
  });
  await prisma.documentVersion.updateMany({
    where: { documentId },
    data: { malwareScanStatus: scanStatus, scannedAt: new Date() },
  });
}

describe('Case document presigned upload integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: DocumentService;
  let storage: LocalObjectStorageAdapter;
  let envelopeService: DocumentEnvelopeService;
  let cryptoService: CryptoService;
  let secretaryUser: AuthenticatedUser;
  let councilMemberUser: AuthenticatedUser;
  let caseId: string;

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

    const memberRecord = await environment.prisma.user.findUniqueOrThrow({
      where: { email: 'council.member@ethics.local' },
      include: {
        rolesAssigned: { where: { isActive: true } },
        company: true,
      },
    });

    councilMemberUser = {
      id: memberRecord.id,
      email: memberRecord.email,
      displayName: memberRecord.displayName,
      companyId: memberRecord.companyId,
      companyName: memberRecord.company?.name ?? null,
      locationId: memberRecord.locationId,
      functionId: memberRecord.functionId,
      clearanceLevel: memberRecord.clearanceLevel as AuthenticatedUser['clearanceLevel'],
      isGeneralSecretary: memberRecord.isGeneralSecretary,
      roles: memberRecord.rolesAssigned.map((role) => role.roleCode as Role),
    };

    const reportId = randomUUID();
    caseId = randomUUID();

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-DOC-TEST1',
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

    const keyManagement = new LocalKeyManagementAdapter(buildEnvService());
    cryptoService = new CryptoService(keyManagement);
    envelopeService = new DocumentEnvelopeService(cryptoService);
    storage = new LocalObjectStorageAdapter();

    const documentAccess = new DocumentAccessService(environment.prisma as never);
    const documentPolicy = new DocumentPolicyService({ get: () => documentAccess } as never);
    documentPolicy.wireDocumentAccessServiceForTests(documentAccess);

    service = new DocumentService(
      environment.prisma as never,
      new PolicyScopeService(),
      documentPolicy,
      cryptoService,
      envelopeService,
      documentAccess,
      storage,
      new AuditEventPublisher(),
    );
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('initiateCaseDocumentUpload presigned URL döner — sync scan yapmaz', async () => {
    const fileContent = Buffer.from('temiz pdf içeriği simülasyonu');
    const result = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'on-arastirma.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.PRE_RESEARCH_NOTE,
        title: 'Ön Araştırma Notu',
      },
      randomUUID(),
    );

    expect(result.uploadUrl).toMatch(/^local-storage:\/\/put\//);
    expect(result.status).toBe(DocumentStatus.QUARANTINED);
    expect(result.malwareScanStatus).toBe(MalwareScanStatus.PENDING);
    expect(result.versionNo).toBe(1);

    const document = await environment.prisma.document.findUnique({
      where: { id: result.id },
      include: { versions: true },
    });

    expect(document?.status).toBe(DocumentStatus.QUARANTINED);
    expect(document?.versions).toHaveLength(1);
    expect(document?.versions[0]?.malwareScanStatus).toBe(MalwareScanStatus.PENDING);
    expect(document?.versions[0]?.originalFilenameEncrypted).not.toContain('on-arastirma.pdf');
    expect(document?.versions[0]?.encryptionAlgorithm).toBe('AES-256-GCM');

    const auditOutbox = await environment.prisma.auditOutbox.findFirst({
      where: {
        eventType: AuditEventType.DOCUMENT_UPLOADED,
        resourceId: result.id,
      },
    });
    expect(auditOutbox).not.toBeNull();
  });

  it('complete-upload sonrası storage ciphertext içerir — plaintext kalmaz', async () => {
    const fileContent = Buffer.from('envelope encryption roundtrip içeriği');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'kanit.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Şirket Kanıtı',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);

    const sealed = await service.completeCaseDocumentUpload(
      secretaryUser,
      caseId,
      initiated.id,
      randomUUID(),
    );

    expect(sealed.contentSealedAt).toBeTruthy();

    const storedObject = await storage.getObjectBuffer(storageKey);
    expect(storedObject.equals(fileContent)).toBe(false);
    expect(storedObject.toString('utf8')).not.toContain('envelope encryption roundtrip');

    const version = await environment.prisma.documentVersion.findFirstOrThrow({
      where: { documentId: initiated.id, versionNo: 1 },
    });
    const metadata = envelopeService.buildEncryptionMetadata(
      version.encryptedDek,
      version.kmsKeyId,
      version.encryptionAlgorithm,
    );
    const opened = await cryptoService.openDocumentContent(storedObject, metadata);
    expect(opened).toEqual(fileContent);
  });

  it('seal sonrası download presigned URL döner ve içerik roundtrip yapar', async () => {
    const fileContent = Buffer.from('indirilebilir doküman içeriği');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'rapor.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.RAPPORTEUR_REPORT,
        title: 'Raportör Raporu',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());
    await simulateMalwareScanResult(environment.prisma, initiated.id, 'clean');

    const download = await service.getDocumentDownloadUrl(
      secretaryUser,
      initiated.id,
      randomUUID(),
    );

    expect(download.downloadUrl).toMatch(/^local-storage:\/\/get\//);
    expect(download.filename).toBe('rapor.pdf');
    expect(download.expiresAt).toBeTruthy();

    const expiresAtMs = new Date(download.expiresAt).getTime();
    const ttlSeconds = Math.round((expiresAtMs - Date.now()) / 1000);
    expect(ttlSeconds).toBeGreaterThan(PRESIGNED_DOWNLOAD_TTL_SECONDS - 15);
    expect(ttlSeconds).toBeLessThanOrEqual(PRESIGNED_DOWNLOAD_TTL_SECONDS);

    const cacheKey = extractLocalStorageDownloadKey(download.downloadUrl);
    const downloaded = await storage.getObjectBuffer(cacheKey);
    expect(downloaded).toEqual(fileContent);
  });

  it('vaka erişimi var grant yok → download AUTHZ_FORBIDDEN fırlatır', async () => {
    const fileContent = Buffer.from('grant kontrolü içeriği');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'gizli.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.DECISION_DRAFT,
        title: 'Karar Taslağı',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());
    await simulateMalwareScanResult(environment.prisma, initiated.id, 'clean');

    await environment.prisma.documentAccessGrant.deleteMany({
      where: { documentId: initiated.id, grantedToUserId: { not: secretaryUser.id } },
    });

    await expect(
      service.getDocumentDownloadUrl(councilMemberUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('grant iptal edilmiş kullanıcı download AUTHZ_FORBIDDEN fırlatır', async () => {
    const fileContent = Buffer.from('iptal grant içeriği');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'iptal.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'İptal Test',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());
    await simulateMalwareScanResult(environment.prisma, initiated.id, 'clean');

    const uploaderGrant = await environment.prisma.documentAccessGrant.findFirstOrThrow({
      where: { documentId: initiated.id, grantedToUserId: secretaryUser.id, revokedAt: null },
    });

    await environment.prisma.documentAccessGrant.update({
      where: { id: uploaderGrant.id },
      data: { revokedAt: new Date() },
    });

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('listCaseDocuments yalnızca grant sahibi kullanıcıya doküman döner', async () => {
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'liste-test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        contentSha256: sha256Hex('liste-test'),
        documentCategory: DocumentCategory.PRE_RESEARCH_NOTE,
        title: 'Liste Test',
      },
      randomUUID(),
    );

    const uploaderList = await service.listCaseDocuments(secretaryUser, caseId);
    expect(uploaderList.some((item) => item.id === initiated.id)).toBe(true);
    expect(uploaderList.find((item) => item.id === initiated.id)?.canDownload).toBe(false);

    const outsiderList = await service.listCaseDocuments(councilMemberUser, caseId);
    expect(outsiderList.some((item) => item.id === initiated.id)).toBe(false);
  });

  it('upload sonrası yükleyiciye otomatik grant oluşturulur', async () => {
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'auto-grant.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
        contentSha256: sha256Hex('autogrant'),
        documentCategory: DocumentCategory.PRE_RESEARCH_NOTE,
        title: 'Auto Grant',
      },
      randomUUID(),
    );

    const grant = await environment.prisma.documentAccessGrant.findFirst({
      where: {
        documentId: initiated.id,
        grantedToUserId: secretaryUser.id,
        revokedAt: null,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      },
    });

    expect(grant).not.toBeNull();
  });

  it('mühürlenmemiş doküman için download DOCUMENT_QUARANTINED fırlatır', async () => {
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'bekleyen.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4,
        contentSha256: sha256Hex('wait'),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Bekleyen',
      },
      randomUUID(),
    );

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: 'DOCUMENT_QUARANTINED' });
  });

  it('mühürlenmiş ama tarama bekleyen doküman için download DOCUMENT_QUARANTINED fırlatır', async () => {
    const fileContent = Buffer.from('tarama bekleyen içerik');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'bekleyen-tarama.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Tarama Bekliyor',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.DOCUMENT_QUARANTINED });
  });

  it('REJECTED doküman için download DOCUMENT_REJECTED fırlatır', async () => {
    const fileContent = Buffer.from('reddedilen içerik');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'reddedildi.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Reddedildi',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());
    await simulateMalwareScanResult(environment.prisma, initiated.id, 'rejected');

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.DOCUMENT_REJECTED });
  });

  it('izin verilmeyen MIME tipi için DOCUMENT_TYPE_NOT_ALLOWED fırlatır', async () => {
    await expect(
      service.initiateCaseDocumentUpload(
        secretaryUser,
        caseId,
        {
          originalFilename: 'script.exe',
          mimeType: 'application/x-msdownload',
          sizeBytes: 100,
          contentSha256: sha256Hex('x'),
          documentCategory: DocumentCategory.COMPANY_EVIDENCE,
          title: 'Geçersiz dosya',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'DOCUMENT_TYPE_NOT_ALLOWED' });
  });

  it('erişilemeyen vaka için RESOURCE_NOT_FOUND fırlatır', async () => {
    await expect(
      service.initiateCaseDocumentUpload(
        secretaryUser,
        randomUUID(),
        {
          originalFilename: 'kanit.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          contentSha256: sha256Hex('x'),
          documentCategory: DocumentCategory.COMPANY_EVIDENCE,
          title: 'Kanıt',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
