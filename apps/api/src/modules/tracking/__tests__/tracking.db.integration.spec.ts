import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ClearanceLevel,
  ErrorCode,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
} from '@ethics/shared';
import type { CreateReportBody } from '@ethics/dto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import { NotificationService } from '../../../notification/notification.service.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { IntakeService } from '../../intake/intake.service.js';
import { TrackingPasswordService } from '../../intake/tracking-password.service.js';
import { SecureMessageService } from '../secure-message.service.js';
import { TRACKING_CODE_HEADER, TRACKING_PASSWORD_HEADER } from '../tracking.constants.js';
import { TrackingAttemptService } from '../tracking-attempt.service.js';
import { TrackingCredentialService } from '../tracking-credential.service.js';
import { TrackingService } from '../tracking.service.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');
const KVKK_VERSION = '1.0';
const TRACKING_PASSWORD = 'MySecretPass123!';

function buildEnvService(): EnvService {
  return {
    isProduction: false,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
    ipHashPepper: 'test-pepper',
    bruteForceMaxAttempts: 5,
    bruteForceLockoutMinutes: 15,
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
    incidentDescription: 'Sentetik tracking entegrasyon testi olay açıklaması.',
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
    trackingPassword: TRACKING_PASSWORD,
    kvkkConsentVersion: KVKK_VERSION,
  };
}

function buildRequest(headers: Record<string, string>) {
  return {
    ip: '203.0.113.10',
    headers,
  } as never;
}

describe('TrackingService integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let intakeService: IntakeService;
  let trackingService: TrackingService;
  let secureMessageService: SecureMessageService;
  let trackingPasswordService: TrackingPasswordService;
  let companyId: string;
  let trackingCode: string;

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

    const envService = buildEnvService();
    const keyManagement = new LocalKeyManagementAdapter(envService);
    const cryptoService = new CryptoService(keyManagement);
    const auditPublisher = new AuditEventPublisher();
    trackingPasswordService = new TrackingPasswordService();
    const trackingAttemptService = new TrackingAttemptService(
      environment.prisma as never,
      envService,
    );
    const trackingCredentialService = new TrackingCredentialService(
      environment.prisma as never,
      trackingPasswordService,
    );

    intakeService = new IntakeService(
      environment.prisma as never,
      cryptoService,
      trackingPasswordService,
      auditPublisher,
    );

    const notificationService = new NotificationService(new NotificationEventPublisher());

    secureMessageService = new SecureMessageService(
      environment.prisma as never,
      cryptoService,
      auditPublisher,
      notificationService,
    );

    trackingService = new TrackingService(
      environment.prisma as never,
      trackingCredentialService,
      trackingAttemptService,
      auditPublisher,
      secureMessageService,
    );

    const created = await intakeService.createReport(buildValidReportBody(companyId), randomUUID());
    trackingCode = created.trackingCode;
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('verify success → reportStatus + audit outbox aynı tx', async () => {
    const correlationId = randomUUID();

    const result = await trackingService.verify(
      buildRequest({
        [TRACKING_CODE_HEADER]: trackingCode,
        [TRACKING_PASSWORD_HEADER]: TRACKING_PASSWORD,
      }),
      correlationId,
    );

    expect(result).toMatchObject({
      verified: true,
      reportStatus: ReportStatus.SUBMITTED,
      hasUnreadMessages: false,
    });
    expect(result.submittedAt).toBeTruthy();

    const outbox = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId },
    });

    expect(outbox).toMatchObject({
      eventType: AuditEventType.TRACKING_VERIFY_ATTEMPT,
      actorType: AuditActorType.ANONYMOUS,
      outcome: AuditOutcome.SUCCESS,
      dispatchStatus: 'PENDING',
    });
    expect(outbox?.metadataJson).toMatchObject({
      lockout_triggered: false,
    });
    expect(JSON.stringify(outbox?.metadataJson)).toContain('ETK-');
    expect(JSON.stringify(outbox?.metadataJson)).not.toContain(TRACKING_PASSWORD);
  });

  it('verify wrong password → AUTH_INVALID_CREDENTIALS + failure audit', async () => {
    const correlationId = randomUUID();

    await expect(
      trackingService.verify(
        buildRequest({
          [TRACKING_CODE_HEADER]: trackingCode,
          [TRACKING_PASSWORD_HEADER]: 'WrongPassword1!',
        }),
        correlationId,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
    });

    const outbox = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId },
    });

    expect(outbox).toMatchObject({
      eventType: AuditEventType.TRACKING_VERIFY_ATTEMPT,
      outcome: AuditOutcome.FAILURE,
    });
  });

  it('5 başarısız deneme sonrası verify → AUTH_ACCOUNT_LOCKED', async () => {
    const isolatedCode = (
      await intakeService.createReport(
        {
          ...buildValidReportBody(companyId),
          trackingPassword: 'LockoutTest1!',
        },
        randomUUID(),
      )
    ).trackingCode;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        trackingService.verify(
          buildRequest({
            [TRACKING_CODE_HEADER]: isolatedCode,
            [TRACKING_PASSWORD_HEADER]: 'WrongPassword1!',
          }),
          randomUUID(),
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    }

    await expect(
      trackingService.verify(
        buildRequest({
          [TRACKING_CODE_HEADER]: isolatedCode,
          [TRACKING_PASSWORD_HEADER]: 'WrongPassword1!',
        }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_ACCOUNT_LOCKED,
    });

    const lockoutAudit = await environment.prisma.auditOutbox.findFirst({
      where: {
        eventType: AuditEventType.TRACKING_AUTH_FAILED,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(lockoutAudit).toMatchObject({
      actorType: AuditActorType.ANONYMOUS,
      outcome: AuditOutcome.FAILURE,
    });
    expect(lockoutAudit?.metadataJson).toMatchObject({
      lockout_triggered: true,
      attempt_count: 5,
    });
  });

  it('getStatus → minimal durum bilgisi, içerik yok', async () => {
    const report = await environment.prisma.report.findUnique({
      where: { trackingCode },
    });

    expect(report).not.toBeNull();
    if (!report) {
      throw new Error('Expected report');
    }

    const status = trackingService.getStatus({
      trackingReport: {
        reportId: report.id,
        trackingCode,
        status: ReportStatus.SUBMITTED,
        submittedAt: report.submittedAt,
        lastActivityAt: report.lastActivityAt,
        companyId: report.companyId,
      },
    } as never);

    expect(status).toMatchObject({
      trackingCode,
      status: ReportStatus.SUBMITTED,
      statusLabel: 'Alındı',
    });
    expect(status.submittedAt).toBeTruthy();
    expect(Object.keys(status)).toEqual([
      'trackingCode',
      'status',
      'statusLabel',
      'submittedAt',
      'lastActivityAt',
    ]);
  });

  it('stored tracking hash argon2id kalır', async () => {
    const stored = await environment.prisma.report.findUnique({
      where: { trackingCode },
    });

    expect(stored).not.toBeNull();
    if (!stored) {
      throw new Error('Expected stored report');
    }
    expect(trackingPasswordService.isArgon2idHash(stored.trackingCodePasswordHash)).toBe(true);
    expect(stored.channel).toBe(ReportChannel.WEB_FORM);
    expect(stored.confidentialityLevel).toBe(ClearanceLevel.SENSITIVE);
  });
});
