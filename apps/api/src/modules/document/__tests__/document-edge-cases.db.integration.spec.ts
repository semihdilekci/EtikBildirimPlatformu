import { createHash, randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  DocumentCategory,
  DocumentGrantScope,
  DocumentStatus,
  ErrorCode,
  MalwareScanStatus,
  MAX_TOTAL_CASE_DOCUMENT_BYTES,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  TaskStatus,
  TaskType,
  WORKFLOW_VERSION,
  WorkflowCommand,
  AuditActorType,
  CaseState,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { seedRoleTestUsers, seedSyntheticCompany } from '@ethics/test-fixtures';
import { createDocumentServiceForTests } from './document-service.test-factory.js';
import { buildCaseDocumentStorageKey } from '../file-upload.validation.js';
import type { DocumentService } from '../document.service.js';
import type { LocalObjectStorageAdapter } from '../../../storage/local-object-storage.adapter.js';

function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('DocumentService edge cases (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: DocumentService;
  let storage: LocalObjectStorageAdapter;
  let secretaryUser: AuthenticatedUser;
  let outsiderUser: AuthenticatedUser;
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

    outsiderUser = {
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
        trackingCode: 'ETK-EDGE001',
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
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('toplam vaka doküman boyutu limiti aşıldığında DOCUMENT_SIZE_EXCEEDED fırlatır', async () => {
    const existingDocId = randomUUID();
    const existingVersionId = randomUUID();

    await environment.prisma.document.create({
      data: {
        id: existingDocId,
        caseId,
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Büyük mevcut doküman',
        currentVersionNo: 1,
        status: DocumentStatus.QUARANTINED,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        uploadedByUserId: secretaryUser.id,
        versions: {
          create: {
            id: existingVersionId,
            versionNo: 1,
            storageKeyCiphertext: 'cipher',
            encryptedDek: 'dek',
            kmsKeyId: 'local-document-kek',
            encryptionAlgorithm: 'AES-256-GCM',
            contentSha256: sha256Hex('big'),
            sizeBytes: BigInt(MAX_TOTAL_CASE_DOCUMENT_BYTES - 1024),
            mimeType: 'application/pdf',
            originalFilenameEncrypted: 'cipher',
            malwareScanStatus: MalwareScanStatus.PENDING,
            uploadedByUserId: secretaryUser.id,
          },
        },
      },
    });

    await expect(
      service.initiateCaseDocumentUpload(
        secretaryUser,
        caseId,
        {
          originalFilename: 'ek.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          contentSha256: sha256Hex('ek'),
          documentCategory: DocumentCategory.COMPANY_EVIDENCE,
          title: 'Limit aşımı',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.DOCUMENT_SIZE_EXCEEDED });
  });

  it('complete-upload storage boşken VALIDATION_FAILED fırlatır', async () => {
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'bos.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        contentSha256: sha256Hex('bos'),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Boş storage',
      },
      randomUUID(),
    );

    await expect(
      service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('complete-upload sha256 uyuşmazlığında VALIDATION_FAILED fırlatır', async () => {
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'hash.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20,
        contentSha256: sha256Hex('beklenen'),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Hash test',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, Buffer.from('farklı içerik'));

    await expect(
      service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('complete-upload zaten mühürlenmiş dokümanda VALIDATION_FAILED fırlatır', async () => {
    const fileContent = Buffer.from('çift mühür');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'cift.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Çift mühür',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    await expect(
      service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('complete-upload yanlış caseId ile RESOURCE_NOT_FOUND fırlatır', async () => {
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'case.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5,
        contentSha256: sha256Hex('case'),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Case mismatch',
      },
      randomUUID(),
    );

    await expect(
      service.completeCaseDocumentUpload(secretaryUser, randomUUID(), initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('geçersiz taskId ile RESOURCE_NOT_FOUND fırlatır', async () => {
    await expect(
      service.initiateCaseDocumentUpload(
        secretaryUser,
        caseId,
        {
          originalFilename: 'task.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 5,
          contentSha256: sha256Hex('task'),
          documentCategory: DocumentCategory.COMPANY_EVIDENCE,
          title: 'Task test',
          taskId: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('geçerli taskId ile upload başarılı olur', async () => {
    const transition = await environment.prisma.caseTransition.findFirstOrThrow({
      where: { caseId },
    });
    const taskId = randomUUID();
    await environment.prisma.task.create({
      data: {
        id: taskId,
        caseId,
        taskType: TaskType.PRE_RESEARCH_TASK,
        status: TaskStatus.PENDING,
        assignedRole: Role.COUNCIL_SECRETARY,
        assignedUserId: secretaryUser.id,
        createdByTransitionId: transition.id,
      },
    });

    const result = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'taskli.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 6,
        contentSha256: sha256Hex('taskli'),
        documentCategory: DocumentCategory.PRE_RESEARCH_NOTE,
        title: 'Görevli upload',
        taskId,
      },
      randomUUID(),
    );

    expect(result.id).toBeTruthy();
  });

  it('download bilinmeyen documentId → RESOURCE_NOT_FOUND (grant bypass bilgi sızıntısı yok)', async () => {
    await expect(
      service.getDocumentDownloadUrl(secretaryUser, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('download grant bypass — vaka erişimi var grant yok → AUTHZ_FORBIDDEN', async () => {
    const fileContent = Buffer.from('grant bypass test');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'bypass.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.DECISION_DRAFT,
        title: 'Bypass',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    await environment.prisma.document.update({
      where: { id: initiated.id },
      data: { status: DocumentStatus.AVAILABLE, contentSealedAt: new Date() },
    });
    await environment.prisma.documentVersion.updateMany({
      where: { documentId: initiated.id },
      data: { malwareScanStatus: MalwareScanStatus.CLEAN, scannedAt: new Date() },
    });

    await environment.prisma.documentAccessGrant.deleteMany({
      where: { documentId: initiated.id, grantedToUserId: outsiderUser.id },
    });

    await expect(
      service.getDocumentDownloadUrl(outsiderUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('createUserGrant idempotent — aynı kullanıcıya ikinci grant oluşturmaz', async () => {
    const documentId = randomUUID();
    await environment.prisma.document.create({
      data: {
        id: documentId,
        caseId,
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Idempotent grant',
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        uploadedByUserId: secretaryUser.id,
      },
    });

    const ctx = createDocumentServiceForTests(environment.prisma as never);

    await environment.prisma.$transaction(async (tx) => {
      await ctx.documentAccess.createUserGrant(tx, {
        documentId,
        grantedToUserId: secretaryUser.id,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
      await ctx.documentAccess.createUserGrant(tx, {
        documentId,
        grantedToUserId: secretaryUser.id,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      });
    });

    const grants = await environment.prisma.documentAccessGrant.findMany({
      where: { documentId, grantedToUserId: secretaryUser.id, revokedAt: null },
    });
    expect(grants).toHaveLength(1);
  });

  it('download vaka scope dışı kullanıcı → RESOURCE_NOT_FOUND (bilgi sızıntısı yok)', async () => {
    const otherCompany = await environment.prisma.company.create({
      data: {
        code: `OTHER-CO-${randomUUID().slice(0, 8)}`,
        name: 'Diğer Şirket',
        sourceSystem: 'seed',
        sourceRecordId: randomUUID(),
      },
    });
    const actionOwnerId = randomUUID();

    await environment.prisma.user.create({
      data: {
        id: actionOwnerId,
        email: `scope-deny-${actionOwnerId}@ethics.local`,
        displayName: 'Scope Deny User',
        clearanceLevel: ClearanceLevel.SENSITIVE,
        companyId: otherCompany.id,
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: actionOwnerId,
        roleCode: Role.ACTION_OWNER,
        assignedBy: secretaryUser.id,
        isActive: true,
      },
    });

    const fileContent = Buffer.from('scope deny test');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'scope.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Scope Deny',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    await environment.prisma.document.update({
      where: { id: initiated.id },
      data: { status: DocumentStatus.AVAILABLE, contentSealedAt: new Date() },
    });
    await environment.prisma.documentVersion.updateMany({
      where: { documentId: initiated.id },
      data: { malwareScanStatus: MalwareScanStatus.CLEAN, scannedAt: new Date() },
    });

    await environment.prisma.documentAccessGrant.create({
      data: {
        id: randomUUID(),
        documentId: initiated.id,
        grantedToUserId: actionOwnerId,
        grantScope: DocumentGrantScope.FULL_ACCESS,
      },
    });

    const scopeDenyUser: AuthenticatedUser = {
      id: actionOwnerId,
      email: `scope-deny-${actionOwnerId}@ethics.local`,
      displayName: 'Scope Deny User',
      companyId: otherCompany.id,
      companyName: null,
      locationId: null,
      functionId: null,
      clearanceLevel: ClearanceLevel.SENSITIVE,
      isGeneralSecretary: false,
      roles: [Role.ACTION_OWNER],
    };

    await expect(
      service.getDocumentDownloadUrl(scopeDenyUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('download versiyon bulunamadığında RESOURCE_NOT_FOUND fırlatır', async () => {
    const fileContent = Buffer.from('versiyon yok');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'noversion.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'No Version',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    await environment.prisma.document.update({
      where: { id: initiated.id },
      data: {
        status: DocumentStatus.AVAILABLE,
        contentSealedAt: new Date(),
        currentVersionNo: 99,
      },
    });

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('download versiyon REJECTED tarama durumunda DOCUMENT_REJECTED fırlatır', async () => {
    const fileContent = Buffer.from('versiyon rejected');
    const initiated = await service.initiateCaseDocumentUpload(
      secretaryUser,
      caseId,
      {
        originalFilename: 'ver-rej.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
        documentCategory: DocumentCategory.COMPANY_EVIDENCE,
        title: 'Version Rejected',
      },
      randomUUID(),
    );

    const storageKey = buildCaseDocumentStorageKey(caseId, initiated.id, 1);
    storage.putObjectForTest(storageKey, fileContent);
    await service.completeCaseDocumentUpload(secretaryUser, caseId, initiated.id, randomUUID());

    await environment.prisma.document.update({
      where: { id: initiated.id },
      data: { status: DocumentStatus.AVAILABLE, contentSealedAt: new Date() },
    });
    await environment.prisma.documentVersion.updateMany({
      where: { documentId: initiated.id },
      data: { malwareScanStatus: MalwareScanStatus.REJECTED, scannedAt: new Date() },
    });

    await expect(
      service.getDocumentDownloadUrl(secretaryUser, initiated.id, randomUUID()),
    ).rejects.toMatchObject({ code: ErrorCode.DOCUMENT_REJECTED });
  });
});
