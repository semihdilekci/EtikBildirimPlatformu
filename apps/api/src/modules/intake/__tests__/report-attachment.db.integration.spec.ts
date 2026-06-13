import { createHash, randomUUID } from 'node:crypto';

import {
  AuditEventType,
  ClearanceLevel,
  MalwareScanStatus,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { LocalObjectStorageAdapter } from '../../../storage/local-object-storage.adapter.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { ReportAttachmentService } from '../report-attachment.service.js';

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

describe('Report attachment presigned upload integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: ReportAttachmentService;
  let reportTrackingCode: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    const companyId = await seedSyntheticCompany(environment.prisma);

    const reportId = randomUUID();
    reportTrackingCode = 'ETK-ABCD-EFGH';

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: reportTrackingCode,
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

    const keyManagement = new LocalKeyManagementAdapter(buildEnvService());
    const cryptoService = new CryptoService(keyManagement);
    const storage = new LocalObjectStorageAdapter();

    service = new ReportAttachmentService(
      environment.prisma as never,
      cryptoService,
      keyManagement,
      storage,
      new AuditEventPublisher(),
    );
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('initiateUpload presigned URL döner — upload path sync scan yapmaz', async () => {
    const fileContent = Buffer.from('temiz pdf içeriği simülasyonu');
    const result = await service.initiateUpload({
      trackingCode: reportTrackingCode,
      body: {
        originalFilename: 'kanit.pdf',
        mimeType: 'application/pdf',
        sizeBytes: fileContent.length,
        contentSha256: sha256Hex(fileContent),
      },
      correlationId: randomUUID(),
      auditEventType: AuditEventType.REPORT_ATTACHMENT_UPLOADED,
      auditAction: 'report_attachment_uploaded',
    });

    expect(result.uploadUrl).toMatch(/^local-storage:\/\/put\//);
    expect(result.malwareScanStatus).toBe(MalwareScanStatus.PENDING);

    const dbRow = await environment.prisma.reportAttachment.findUnique({
      where: { id: result.id },
    });
    expect(dbRow?.malwareScanStatus).toBe(MalwareScanStatus.PENDING);
    expect(dbRow?.originalFilename).not.toContain('kanit.pdf');

    const auditOutbox = await environment.prisma.auditOutbox.findFirst({
      where: {
        eventType: AuditEventType.REPORT_ATTACHMENT_UPLOADED,
        resourceId: result.id,
      },
    });
    expect(auditOutbox).not.toBeNull();
  });

  it('bilinmeyen tracking code için RESOURCE_NOT_FOUND fırlatır', async () => {
    await expect(
      service.initiateUpload({
        trackingCode: 'ETK-WXYZ-RSTU',
        body: {
          originalFilename: 'kanit.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          contentSha256: sha256Hex('x'),
        },
        correlationId: randomUUID(),
        auditEventType: AuditEventType.REPORT_ATTACHMENT_UPLOADED,
        auditAction: 'report_attachment_uploaded',
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
