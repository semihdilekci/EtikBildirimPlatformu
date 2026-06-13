import { createHash, randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  MalwareScanStatus,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { MockMalwareScannerAdapter } from '../../malware/mock-malware-scanner.adapter.js';
import { EICAR_TEST_SIGNATURE } from '../../malware/malware-scanner.port.js';
import { LocalObjectStorageAdapter } from '../../storage/local-object-storage.adapter.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';
import { ClamAvScanJob } from '../clamav-scan.job.js';

function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('ClamAvScanJob integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let storage: LocalObjectStorageAdapter;
  let reportId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    storage = new LocalObjectStorageAdapter();

    const companyId = await seedSyntheticCompany(environment.prisma);
    reportId = randomUUID();

    await environment.prisma.report.create({
      data: {
        id: reportId,
        trackingCode: 'ETK-SCAN-ABCD',
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
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('henüz yüklenmemiş dosyayı atlar (PENDING kalır)', async () => {
    const attachment = await environment.prisma.reportAttachment.create({
      data: {
        reportId,
        originalFilename: 'cipher',
        storageKey: `quarantine/reports/${reportId}/pending-1`,
        encryptedDek: 'dek',
        kmsKeyId: 'local-document-kek-v1',
        contentSha256: sha256Hex('pending'),
        fileSizeBytes: 7n,
        mimeType: 'text/plain',
        malwareScanStatus: MalwareScanStatus.PENDING,
        uploadedBy: 'reporter',
      },
    });

    const job = new ClamAvScanJob(environment.prisma, storage, new MockMalwareScannerAdapter());
    const result = await job.processPendingBatch();

    expect(result.skipped).toBeGreaterThanOrEqual(1);

    const row = await environment.prisma.reportAttachment.findUnique({
      where: { id: attachment.id },
    });
    expect(row?.malwareScanStatus).toBe(MalwareScanStatus.PENDING);
  });

  it('async scan temiz dosyayı CLEAN yapar', async () => {
    const content = Buffer.from('worker clean attachment');
    const storageKey = `quarantine/reports/${reportId}/clean-1`;
    storage.putObject(storageKey, content);

    const attachment = await environment.prisma.reportAttachment.create({
      data: {
        reportId,
        originalFilename: 'cipher',
        storageKey,
        encryptedDek: 'dek',
        kmsKeyId: 'local-document-kek-v1',
        contentSha256: sha256Hex(content),
        fileSizeBytes: BigInt(content.length),
        mimeType: 'text/plain',
        malwareScanStatus: MalwareScanStatus.PENDING,
        uploadedBy: 'reporter',
      },
    });

    const job = new ClamAvScanJob(environment.prisma, storage, new MockMalwareScannerAdapter());
    const result = await job.processPendingBatch();

    expect(result.clean).toBeGreaterThanOrEqual(1);

    const row = await environment.prisma.reportAttachment.findUnique({
      where: { id: attachment.id },
    });
    expect(row?.malwareScanStatus).toBe(MalwareScanStatus.CLEAN);
  });

  it('enfekte dosyayı REJECTED olarak işaretler', async () => {
    const content = Buffer.from(EICAR_TEST_SIGNATURE);
    const storageKey = `quarantine/reports/${reportId}/infected-1`;
    storage.putObject(storageKey, content);

    const attachment = await environment.prisma.reportAttachment.create({
      data: {
        reportId,
        originalFilename: 'cipher',
        storageKey,
        encryptedDek: 'dek',
        kmsKeyId: 'local-document-kek-v1',
        contentSha256: sha256Hex(content),
        fileSizeBytes: BigInt(content.length),
        mimeType: 'text/plain',
        malwareScanStatus: MalwareScanStatus.PENDING,
        uploadedBy: 'reporter',
      },
    });

    const job = new ClamAvScanJob(environment.prisma, storage, new MockMalwareScannerAdapter());
    await job.processPendingBatch();

    const row = await environment.prisma.reportAttachment.findUnique({
      where: { id: attachment.id },
    });
    expect(row?.malwareScanStatus).toBe(MalwareScanStatus.REJECTED);
  });
});
