import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuditEventType, ErrorCode, NotificationTemplateCode, Role } from '@ethics/shared';
import { seedRoleTestUsers } from '@ethics/test-fixtures';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SafeLoggerService } from '../../../audit/safe-logger.service.js';
import { PolicyGuardService } from '../../../authorization/policy-guard.service.js';
import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import { PolicyGuard } from '../../../common/guards/policy.guard.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import { ActionMatrixConfigService } from '../maker-checker/action-matrix-config.service.js';
import { ApprovalWorkItemService } from '../maker-checker/approval-work-item.service.js';
import { NotificationTemplateController } from '../notification/notification-template.controller.js';
import { KvkkTextController } from '../kvkk/kvkk-text.controller.js';
import { NotificationTemplateAdminService } from '../notification/notification-template-admin.service.js';
import { KvkkTextAdminService } from '../kvkk/kvkk-text-admin.service.js';
import { EmailRelayService } from '../../integration/email/email-relay.service.js';
import { seedNotificationTemplates } from '../../notification/notification-template.seed.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin notification templates + KVKK texts DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);
    await seedNotificationTemplates(environment.prisma);

    await environment.prisma.kvkkConsentVersion.upsert({
      where: { versionCode: '1.0' },
      create: {
        versionCode: '1.0',
        contentText: 'Sentetik KVKK metni v1.0',
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        isActive: true,
      },
      update: { isActive: true },
    });

    usersByEmail = new Map(
      await Promise.all(
        [
          'superadmin@ethics.local',
          'council.secretary@ethics.local',
          'council.member@ethics.local',
        ].map(async (email) => [email, await loadAuthenticatedUser(environment, email)] as const),
      ),
    );

    const prismaService = environment.prisma as unknown as PrismaService;
    const seedSuperAdmin = usersByEmail.get('superadmin@ethics.local');
    if (!seedSuperAdmin) {
      throw new Error('Test user not found: superadmin@ethics.local');
    }
    let activeUser = seedSuperAdmin;

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationTemplateController, KvkkTextController],
      providers: [
        NotificationTemplateAdminService,
        KvkkTextAdminService,
        ActionMatrixConfigService,
        MakerCheckerService,
        ApprovalWorkItemService,
        AuditEventPublisher,
        {
          provide: EmailRelayService,
          useValue: {
            isConfigured: () => true,
            sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
          },
        },
        { provide: PrismaService, useValue: prismaService },
        Reflector,
        PolicyGuardService,
        PolicyGuard,
        {
          provide: AuthService,
          useValue: {
            loadAuthenticatedUser: (userId: string) => {
              const match = [...usersByEmail.values()].find((user) => user.id === userId);
              return Promise.resolve(match ?? null);
            },
          },
        },
        SessionAuthGuard,
        {
          provide: APP_GUARD,
          useExisting: SessionAuthGuard,
        },
        {
          provide: APP_GUARD,
          useExisting: PolicyGuard,
        },
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
        {
          provide: SafeLoggerService,
          useValue: createSafeLoggerMock(),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));

    app.use((req: Request, _res: Response, next: NextFunction) => {
      const headerUserId = req.headers['x-test-user-id'];
      if (typeof headerUserId === 'string') {
        activeUser =
          [...usersByEmail.values()].find((user) => user.id === headerUserId) ?? activeUser;
      }

      const correlationHeader = req.headers['x-correlation-id'];
      if (typeof correlationHeader === 'string') {
        (req as Request & { correlationId?: string }).correlationId = correlationHeader;
      }

      req.user = { userId: activeUser.id };
      next();
    });

    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await environment.teardown();
  }, 30_000);

  async function loadAuthenticatedUser(
    env: PostgresTestEnvironment,
    email: string,
  ): Promise<AuthenticatedUser> {
    const user = await env.prisma.user.findUniqueOrThrow({
      where: { email },
      include: {
        rolesAssigned: { where: { isActive: true } },
        company: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.rolesAssigned.map((role) => role.roleCode as Role),
      clearanceLevel: user.clearanceLevel as AuthenticatedUser['clearanceLevel'],
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      functionId: user.functionId,
      locationId: user.locationId,
      isGeneralSecretary: user.isGeneralSecretary,
    };
  }

  function userIdFor(email: string): string {
    const user = usersByEmail.get(email);
    if (!user) {
      throw new Error(`Test user not found: ${email}`);
    }
    return user.id;
  }

  it('normal user notification templates list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/notification-templates')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('admin notification templates list → 200 with 28 templates', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/notification-templates')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data).toHaveLength(29);
    expect(response.body.data[0]).toHaveProperty('templateCode');
    expect(response.body.data[0]).toHaveProperty('pendingBatchId');
  });

  it('template preview escapes XSS payload in htmlBody', async () => {
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/notification-templates/preview/${NotificationTemplateCode.TASK_ASSIGNED}`,
      )
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        bodyTemplate: 'Test gövde <script>alert(1)</script>',
      });

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.textBody).toContain('<script>alert(1)</script>');
    expect(response.body.data.htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(response.body.data.htmlBody).not.toContain('<script>');
  });

  it('notification template maker-checker happy path', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/notification-templates/${NotificationTemplateCode.TASK_ASSIGNED}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        bodyTemplate: 'Güncellenmiş görev atama şablonu metni.',
        reason: 'Test şablon güncellemesi',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    expect(proposeResponse.body.data.status).toBe('PENDING');
    const batchId = proposeResponse.body.data.batchId as string;

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/notification-templates/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({
        approved: true,
        reason: 'Test onayı',
      });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('APPROVED');
    expect(approveResponse.body.data.appliedTemplateCodes).toContain(
      NotificationTemplateCode.TASK_ASSIGNED,
    );

    const template = await environment.prisma.notificationTemplate.findUniqueOrThrow({
      where: { templateCode: NotificationTemplateCode.TASK_ASSIGNED },
    });
    expect(template.bodyTemplate).toBe('Güncellenmiş görev atama şablonu metni.');
    expect(template.versionNo).toBeGreaterThan(1);
  });

  it('notification template same-user approve → 422 MAKER_CHECKER_SELF', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/notification-templates/${NotificationTemplateCode.SLA_WARNING}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        bodyTemplate: 'SLA uyarı metni güncellendi.',
        reason: 'Self-approve test',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    const batchId = proposeResponse.body.data.batchId as string;

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/notification-templates/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        approved: true,
        reason: 'Kendi işlemini onaylama denemesi',
      });

    expect(approveResponse.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(approveResponse.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);
  });

  it('normal user KVKK texts list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/kvkk-texts')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('council secretary KVKK texts list → 200', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/kvkk-texts')
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('normal user maker-checker approve → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/kvkk-texts/batches/non-existent/approve')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'))
      .send({ approved: true, reason: 'Yetkisiz onay denemesi.' });

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('send-test email → audit outbox kaydı', async () => {
    const correlationId = 'send-test-audit-correlation';
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/notification-templates/send-test/${NotificationTemplateCode.TASK_ASSIGNED}`,
      )
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .set('x-correlation-id', correlationId)
      .send({
        recipientEmail: 'tester@ethics.local',
        subjectTemplate: 'Test konu',
        bodyTemplate: 'Test gövde metni — hassas içerik yok.',
      });

    expect(response.status).toBe(HttpStatus.OK);

    const auditEvent = await environment.prisma.auditOutbox.findFirst({
      where: {
        correlationId,
        eventType: AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
        action: 'notification_template_test_sent',
      },
    });

    expect(auditEvent).not.toBeNull();
    expect(JSON.stringify(auditEvent?.metadataJson)).not.toContain('tester@ethics.local');
  });

  it('KVKK publish maker-checker happy path creates active version', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/kvkk-texts')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        versionCode: '1.1',
        contentText:
          'Yeni sentetik KVKK aydınlatma metni v1.1 — kişisel verileriniz yalnızca etik bildirim süreci kapsamında işlenir.',
        effectiveDate: '2026-06-15',
        reason: 'Hukuki metin güncellemesi',
      });

    expect(proposeResponse.status).toBe(HttpStatus.CREATED);
    expect(proposeResponse.body.data.status).toBe('PENDING');
    const batchId = proposeResponse.body.data.batchId as string;

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/kvkk-texts/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({
        approved: true,
        reason: 'KVKK metin yayını onaylandı',
      });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('APPROVED');
    expect(approveResponse.body.data.publishedVersionCode).toBe('1.1');

    const activeVersions = await environment.prisma.kvkkConsentVersion.findMany({
      where: { isActive: true },
    });
    expect(activeVersions).toHaveLength(1);
    expect(activeVersions[0]?.versionCode).toBe('1.1');

    const archived = await environment.prisma.kvkkConsentVersion.findUnique({
      where: { versionCode: '1.0' },
    });
    expect(archived?.isActive).toBe(false);

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: { eventType: AuditEventType.KVKK_TEXT_PUBLISHED },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('KVKK publish same-user approve → 422 MAKER_CHECKER_SELF', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/kvkk-texts')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        versionCode: '1.2',
        contentText: 'Başka bir sentetik KVKK metni v1.2 — veri minimizasyonu ilkesi geçerlidir.',
        effectiveDate: '2026-07-01',
        reason: 'Self-approve KVKK test',
      });

    expect(proposeResponse.status).toBe(HttpStatus.CREATED);
    const batchId = proposeResponse.body.data.batchId as string;

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/kvkk-texts/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        approved: true,
        reason: 'Kendi KVKK yayınını onaylama denemesi',
      });

    expect(approveResponse.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(approveResponse.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);
  });
});
