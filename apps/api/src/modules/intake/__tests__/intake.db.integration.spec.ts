import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ClearanceLevel,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
} from '@ethics/shared';
import type { CreateReportBody } from '@ethics/dto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { IntakeService } from '../intake.service.js';
import { TrackingPasswordService } from '../tracking-password.service.js';
import { isValidTrackingCodeFormat } from '../tracking-code.util.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');
const KVKK_VERSION = '1.0';

function buildEnvService(): EnvService {
  return {
    isProduction: false,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
  } as EnvService;
}

function buildValidReportBody(companyId: string): CreateReportBody {
  return {
    companyId,
    incidentCountry: 'TUR',
    incidentCity: 'Bursa',
    incidentLocationDetail: 'Sentetik Fabrika',
    categoryGroup: ReportCategoryGroup.ASSET_FINANCIAL,
    categories: [ReportSubCategory.EMBEZZLEMENT],
    isUncertainCategory: false,
    incidentDescription: 'Sentetik entegrasyon testi olay açıklaması — minimum uzunluk.',
    incidentDateStart: '2026-05-01',
    incidentDateEnd: null,
    incidentIsOngoing: false,
    incidentRecurrence: 'SINGLE',
    howReporterLearned: 'WITNESSED',
    previouslyReported: false,
    previouslyReportedTo: null,
    urgentRiskFlag: false,
    urgentRiskDescription: null,
    involvedPersons: [],
    witnesses: [],
    categorySpecificData: {
      estimatedAmount: '100000-500000',
      currency: 'TRY',
      discoveryMethod: 'FINANCIAL_AUDIT',
    },
    isAnonymous: true,
    reporterIdentityName: null,
    reporterIdentityTitle: null,
    reporterIdentityRelation: null,
    reporterContactEmail: null,
    reporterContactPhone: null,
    trackingPassword: 'MySecretPass123!',
    kvkkConsentVersion: KVKK_VERSION,
  };
}

describe('IntakeService integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: IntakeService;
  let trackingPasswordService: TrackingPasswordService;
  let companyId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();

    await environment.prisma.kvkkConsentVersion.upsert({
      where: { versionCode: KVKK_VERSION },
      create: {
        versionCode: KVKK_VERSION,
        contentText: 'Sentetik KVKK metni',
        publishedAt: new Date(),
        isActive: true,
      },
      update: { isActive: true },
    });

    companyId = await seedSyntheticCompany(environment.prisma);

    const keyManagement = new LocalKeyManagementAdapter(buildEnvService());
    const cryptoService = new CryptoService(keyManagement);
    const auditPublisher = new AuditEventPublisher();
    trackingPasswordService = new TrackingPasswordService();

    service = new IntakeService(
      environment.prisma as never,
      cryptoService,
      trackingPasswordService,
      auditPublisher,
    );
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('createReport → tracking code, argon2id hash, ciphertext DB, audit outbox aynı tx', async () => {
    const correlationId = randomUUID();
    const plaintextDescription = 'Entegrasyon gizli olay açıklaması — şifrelenmeli.';

    const result = await service.createReport(
      {
        ...buildValidReportBody(companyId),
        incidentDescription: plaintextDescription,
      },
      correlationId,
    );

    expect(isValidTrackingCodeFormat(result.trackingCode)).toBe(true);
    expect(result.message).toContain('başarıyla alınmıştır');

    const stored = await environment.prisma.report.findUnique({
      where: { trackingCode: result.trackingCode },
    });

    expect(stored).not.toBeNull();
    if (!stored) {
      throw new Error('Expected stored report');
    }
    expect(stored.incidentDescription).not.toBe(plaintextDescription);
    expect(stored.incidentDescription).not.toContain('Entegrasyon gizli');
    expect(stored.status).toBe(ReportStatus.SUBMITTED);
    expect(stored.confidentialityLevel).toBe(ClearanceLevel.SENSITIVE);
    expect(stored.channel).toBe(ReportChannel.WEB_FORM);
    expect(stored.kvkkConsentVersion).toBe(KVKK_VERSION);
    expect(trackingPasswordService.isArgon2idHash(stored.trackingCodePasswordHash)).toBe(true);

    const verifyOk = await trackingPasswordService.verifyPassword(
      'MySecretPass123!',
      stored.trackingCodePasswordHash,
    );
    expect(verifyOk).toBe(true);

    const outbox = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId },
    });

    expect(outbox).toMatchObject({
      eventType: AuditEventType.REPORT_SUBMITTED,
      actorType: AuditActorType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      dispatchStatus: 'PENDING',
      companyId,
    });
    expect(outbox?.metadataJson).toEqual({
      channel: ReportChannel.WEB_FORM,
      categoryGroup: ReportCategoryGroup.ASSET_FINANCIAL,
      isAnonymous: true,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
    });
    expect(JSON.stringify(outbox?.metadataJson)).not.toContain(plaintextDescription);
  });

  it('pasif şirket → MASTER_DATA_INACTIVE deny', async () => {
    const inactiveCompany = await environment.prisma.company.create({
      data: {
        code: 'INACTIVE-CO',
        name: 'Pasif Şirket',
        isActive: false,
      },
    });

    await expect(
      service.createReport(buildValidReportBody(inactiveCompany.id), randomUUID()),
    ).rejects.toMatchObject({
      code: 'MASTER_DATA_INACTIVE',
    });
  });
});
