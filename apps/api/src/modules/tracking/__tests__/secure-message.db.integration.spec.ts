import { randomUUID } from 'node:crypto';

import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ReportCategoryGroup,
  ReportSubCategory,
  SecureMessageApiDirection,
  SecureMessageDirection,
  SecureMessageSenderType,
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
import { TrackingCredentialService } from '../tracking-credential.service.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');
const KVKK_VERSION = '1.0';
const TRACKING_PASSWORD = 'MySecretPass123!';
const MESSAGE_BODY = 'Ek bilgi olarak şunu belirtmek istiyorum.';

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
    incidentDescription: 'Sentetik secure message entegrasyon testi olay açıklaması.',
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

describe('SecureMessageService integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let intakeService: IntakeService;
  let secureMessageService: SecureMessageService;
  let trackingCredentialService: TrackingCredentialService;
  let companyId: string;
  let reportId: string;
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
    const trackingPasswordService = new TrackingPasswordService();
    trackingCredentialService = new TrackingCredentialService(
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

    const created = await intakeService.createReport(buildValidReportBody(companyId), randomUUID());
    trackingCode = created.trackingCode;

    const report = await environment.prisma.report.findUnique({
      where: { trackingCode },
    });
    expect(report).not.toBeNull();
    if (!report) {
      throw new Error('Expected report');
    }
    reportId = report.id;
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('sendMessage → DB ciphertext, listMessages → decrypt roundtrip', async () => {
    const correlationId = randomUUID();
    const reportContext = {
      reportId,
      trackingCode,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      lastActivityAt: null,
      companyId,
    } as const;

    const sent = await secureMessageService.sendMessage(
      reportContext,
      { bodyText: MESSAGE_BODY },
      correlationId,
    );

    expect(sent.id).toBeTruthy();
    expect(sent.sentAt).toBeTruthy();

    const stored = await environment.prisma.secureMessage.findUnique({
      where: { id: sent.id },
    });

    expect(stored).toMatchObject({
      reportId,
      direction: SecureMessageDirection.INBOUND_FROM_REPORTER,
      senderType: SecureMessageSenderType.ANONYMOUS_REPORTER,
      isRead: true,
    });
    expect(stored?.messageBody).not.toBe(MESSAGE_BODY);
    expect(stored?.messageBody.length).toBeGreaterThan(MESSAGE_BODY.length);

    const sentAudit = await environment.prisma.auditOutbox.findFirst({
      where: {
        correlationId,
        eventType: AuditEventType.SECURE_MESSAGE_SENT,
      },
    });

    expect(sentAudit).toMatchObject({
      actorType: AuditActorType.ANONYMOUS,
      outcome: AuditOutcome.SUCCESS,
      resourceId: sent.id,
    });
    expect(sentAudit?.metadataJson).toMatchObject({
      direction: SecureMessageApiDirection.OUTBOUND,
      message_id: sent.id,
    });
    expect(JSON.stringify(sentAudit?.metadataJson)).not.toContain(MESSAGE_BODY);

    const listCorrelationId = randomUUID();
    const messages = await secureMessageService.listMessages(reportContext, listCorrelationId);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: sent.id,
      direction: SecureMessageApiDirection.OUTBOUND,
      bodyText: MESSAGE_BODY,
      isRead: true,
    });

    const readAudit = await environment.prisma.auditOutbox.findFirst({
      where: {
        correlationId: listCorrelationId,
        eventType: AuditEventType.SECURE_MESSAGE_READ,
      },
    });

    expect(readAudit).toMatchObject({
      actorType: AuditActorType.ANONYMOUS,
      outcome: AuditOutcome.SUCCESS,
      resourceId: reportId,
    });
    expect(readAudit?.metadataJson).toMatchObject({
      message_count: 1,
    });
    expect(JSON.stringify(readAudit?.metadataJson)).not.toContain(MESSAGE_BODY);
  });

  it('OUTBOUND_TO_REPORTER mesajı list sonrası okundu olarak işaretlenir', async () => {
    const inboundMessageId = randomUUID();
    const envService = buildEnvService();
    const keyManagement = new LocalKeyManagementAdapter(envService);
    const cryptoService = new CryptoService(keyManagement);
    const encrypted = await cryptoService.encryptField(
      'Kuruldan gelen mesaj',
      'message_body',
      inboundMessageId,
    );

    await environment.prisma.secureMessage.create({
      data: {
        id: inboundMessageId,
        reportId,
        direction: SecureMessageDirection.OUTBOUND_TO_REPORTER,
        senderType: SecureMessageSenderType.SYSTEM_USER,
        senderUserId: null,
        messageBody: encrypted.ciphertext,
        encryptionMetadata: {
          message_body: {
            encryptedDek: encrypted.encryptedDek,
            kmsKeyId: encrypted.kmsKeyId,
            algorithm: encrypted.algorithm,
          },
        },
        isRead: false,
      },
    });

    const reportContext = {
      reportId,
      trackingCode,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      lastActivityAt: null,
      companyId,
    } as const;

    const messages = await secureMessageService.listMessages(reportContext, randomUUID());
    const inbound = messages.find((message) => message.id === inboundMessageId);

    expect(inbound).toMatchObject({
      direction: SecureMessageApiDirection.INBOUND,
      bodyText: 'Kuruldan gelen mesaj',
      isRead: true,
    });

    const updated = await environment.prisma.secureMessage.findUnique({
      where: { id: inboundMessageId },
    });
    expect(updated?.isRead).toBe(true);
  });

  it('geçersiz tracking parolası → kimlik doğrulama reddedilir', async () => {
    const result = await trackingCredentialService.authenticate(trackingCode, 'WrongPassword1!');

    expect(result).toBeNull();
  });

  it('hasUnreadInboundMessages okunmamış kurul mesajını tespit eder', async () => {
    const unreadId = randomUUID();
    const envService = buildEnvService();
    const keyManagement = new LocalKeyManagementAdapter(envService);
    const cryptoService = new CryptoService(keyManagement);
    const encrypted = await cryptoService.encryptField('Okunmamış', 'message_body', unreadId);

    await environment.prisma.secureMessage.create({
      data: {
        id: unreadId,
        reportId,
        direction: SecureMessageDirection.OUTBOUND_TO_REPORTER,
        senderType: SecureMessageSenderType.SYSTEM_USER,
        messageBody: encrypted.ciphertext,
        encryptionMetadata: {
          message_body: {
            encryptedDek: encrypted.encryptedDek,
            kmsKeyId: encrypted.kmsKeyId,
            algorithm: encrypted.algorithm,
          },
        },
        isRead: false,
      },
    });

    expect(await secureMessageService.hasUnreadInboundMessages(reportId)).toBe(true);
  });
});
