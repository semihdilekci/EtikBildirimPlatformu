import { randomUUID } from 'node:crypto';

import {
  AuditEventType,
  ErrorCode,
  ReportCategoryGroup,
  ReportStatus,
  ReportSubCategory,
  SecureMessageApiDirection,
} from '@ethics/shared';
import type { CreateReportBody } from '@ethics/dto';
import type { Request } from 'express';
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
import { isValidTrackingCodeFormat } from '../../intake/tracking-code.util.js';
import { SecureMessageService } from '../secure-message.service.js';
import { TRACKING_CODE_HEADER, TRACKING_PASSWORD_HEADER } from '../tracking.constants.js';
import { TrackingAttemptService } from '../tracking-attempt.service.js';
import { TrackingCredentialService } from '../tracking-credential.service.js';
import { TrackingService } from '../tracking.service.js';
import type { TrackingReportContext } from '../tracking.types.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');
const KVKK_VERSION = '1.0';
const TRACKING_PASSWORD = 'JourneyPass123!';
const MESSAGE_BODY = 'Ek bilgi: entegrasyon journey mesajı.';

function buildEnvService(): EnvService {
  return {
    isProduction: false,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
    ipHashPepper: 'journey-pepper',
    bruteForceMaxAttempts: 5,
    bruteForceLockoutMinutes: 15,
  } as EnvService;
}

function buildValidReportBody(companyId: string): CreateReportBody {
  return {
    companyId,
    incidentCountry: 'TUR',
    incidentCity: 'İstanbul',
    incidentLocationDetail: 'Journey Test Lokasyonu',
    categoryGroup: ReportCategoryGroup.ASSET_FINANCIAL,
    categories: [ReportSubCategory.EMBEZZLEMENT],
    isUncertainCategory: false,
    incidentDescription:
      'E2E journey entegrasyon testi olay açıklaması — minimum uzunluk sağlanır.',
    incidentDateStart: '2026-06-01',
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

function buildTrackingRequest(trackingCode: string, password: string): Request {
  return {
    ip: '203.0.113.42',
    headers: {
      [TRACKING_CODE_HEADER]: trackingCode,
      [TRACKING_PASSWORD_HEADER]: password,
    },
  } as unknown as Request;
}

describe('Intake + Tracking E2E journey (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let intakeService: IntakeService;
  let trackingService: TrackingService;
  let secureMessageService: SecureMessageService;
  let trackingPasswordService: TrackingPasswordService;
  let companyId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();

    await environment.prisma.kvkkConsentVersion.upsert({
      where: { versionCode: KVKK_VERSION },
      create: {
        versionCode: KVKK_VERSION,
        contentText: 'Journey KVKK metni',
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
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('form gönder → tracking code → verify → status → mesaj roundtrip', async () => {
    const plaintextDescription = 'Journey gizli olay açıklaması — DB ciphertext olmalı.';
    const correlationId = randomUUID();

    const created = await intakeService.createReport(
      {
        ...buildValidReportBody(companyId),
        incidentDescription: plaintextDescription,
      },
      correlationId,
    );

    expect(isValidTrackingCodeFormat(created.trackingCode)).toBe(true);
    expect(created.message).toContain('başarıyla alınmıştır');

    const stored = await environment.prisma.report.findUnique({
      where: { trackingCode: created.trackingCode },
    });

    expect(stored?.incidentDescription).not.toBe(plaintextDescription);
    expect(stored?.kvkkConsentVersion).toBe(KVKK_VERSION);
    expect(stored).not.toBeNull();
    if (!stored) {
      throw new Error('Expected stored report');
    }
    expect(trackingPasswordService.isArgon2idHash(stored.trackingCodePasswordHash)).toBe(true);

    const submitAudit = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId, eventType: AuditEventType.REPORT_SUBMITTED },
    });
    expect(submitAudit).not.toBeNull();
    expect(JSON.stringify(submitAudit?.metadataJson)).not.toContain(plaintextDescription);

    const verifyResult = await trackingService.verify(
      buildTrackingRequest(created.trackingCode, TRACKING_PASSWORD),
      randomUUID(),
    );

    expect(verifyResult).toMatchObject({
      verified: true,
      reportStatus: ReportStatus.SUBMITTED,
      hasUnreadMessages: false,
    });

    const statusRequest = buildTrackingRequest(created.trackingCode, TRACKING_PASSWORD);
    const reportContext: TrackingReportContext = {
      reportId: stored.id,
      trackingCode: created.trackingCode,
      status: ReportStatus.SUBMITTED,
      submittedAt: stored.submittedAt,
      lastActivityAt: stored.lastActivityAt,
      companyId,
    };
    statusRequest.trackingReport = reportContext;

    const status = trackingService.getStatus(statusRequest);
    expect(status).toMatchObject({
      trackingCode: created.trackingCode,
      status: ReportStatus.SUBMITTED,
      statusLabel: 'Alındı',
    });
    expect(status.lastActivityAt).toBeTruthy();
    expect(Object.keys(status)).not.toContain('incidentDescription');

    const messageCorrelationId = randomUUID();
    const sent = await secureMessageService.sendMessage(
      reportContext,
      { bodyText: MESSAGE_BODY },
      messageCorrelationId,
    );

    expect(sent.id).toBeTruthy();

    const messages = await secureMessageService.listMessages(reportContext, randomUUID());

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: sent.id,
      direction: SecureMessageApiDirection.OUTBOUND,
      bodyText: MESSAGE_BODY,
    });

    const messageStored = await environment.prisma.secureMessage.findUnique({
      where: { id: sent.id },
    });
    expect(messageStored?.messageBody).not.toBe(MESSAGE_BODY);
  });

  it('yanlış parola → AUTH_INVALID_CREDENTIALS deny', async () => {
    const created = await intakeService.createReport(buildValidReportBody(companyId), randomUUID());

    await expect(
      trackingService.verify(
        buildTrackingRequest(created.trackingCode, 'WrongPassword1!'),
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
    });
  });
});
