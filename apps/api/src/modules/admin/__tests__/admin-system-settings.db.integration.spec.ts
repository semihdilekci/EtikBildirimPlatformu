import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuditEventType, ErrorCode, Role } from '@ethics/shared';
import { UserFactory, seedRoleTestUsers } from '@ethics/test-fixtures';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
import { ConfigService } from '../config/config.service.js';
import { SystemSettingsController } from '../config/system-settings.controller.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin system settings DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

    await environment.prisma.systemSetting.createMany({
      data: [
        { key: 'brute_force_max_attempts', value: 5, category: 'brute_force' },
        { key: 'brute_force_lockout_minutes', value: 15, category: 'brute_force' },
        { key: 'session_idle_timeout_minutes', value: 30, category: 'session' },
        { key: 'session_absolute_timeout_hours', value: 8, category: 'session' },
        { key: 'rate_limit_login_per_minute', value: 5, category: 'rate_limit' },
        { key: 'rate_limit_intake_per_minute', value: 10, category: 'rate_limit' },
        { key: 'rate_limit_tracking_per_minute', value: 20, category: 'rate_limit' },
        { key: 'rate_limit_upload_per_minute', value: 30, category: 'rate_limit' },
      ],
      skipDuplicates: true,
    });

    const factory = new UserFactory(environment.prisma);
    const checkerAdmin = await factory.create({
      email: 'checker.admin@ethics.local',
      displayName: 'Checker Admin',
    });

    await environment.prisma.userRole.create({
      data: {
        userId: checkerAdmin.id,
        roleCode: Role.ADMIN,
        assignedBy: checkerAdmin.id,
        approvedBy: checkerAdmin.id,
        isActive: true,
        reason: 'Test checker admin seed.',
      },
    });

    usersByEmail = new Map(
      await Promise.all(
        [
          'superadmin@ethics.local',
          'checker.admin@ethics.local',
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
      controllers: [SystemSettingsController],
      providers: [
        ConfigService,
        ActionMatrixConfigService,
        MakerCheckerService,
        AuditEventPublisher,
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

  it('normal user system settings list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/system-settings')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('admin system settings list → 200 metadata only', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/system-settings')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toHaveProperty('key');
    expect(response.body.data[0]).toHaveProperty('group');
    expect(response.body.data[0]).not.toHaveProperty('reportText');
  });

  it('maker-checker happy path: propose → approve → value updated + audit', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .patch('/api/v1/admin/system-settings/brute_force_max_attempts')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        value: 7,
        reason: 'Brute-force eşiği test artışı.',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    expect(proposeResponse.body.data.status).toBe('PENDING');

    const batchId = proposeResponse.body.data.batchId as string;

    const selfApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/system-settings/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ approved: true, reason: 'Self approve denemesi.' });

    expect(selfApprove.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfApprove.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/system-settings/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('checker.admin@ethics.local'))
      .send({ approved: true, reason: 'Onaylandı.' });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('APPROVED');
    expect(approveResponse.body.data.appliedKeys).toContain('brute_force_max_attempts');

    const setting = await environment.prisma.systemSetting.findUniqueOrThrow({
      where: { key: 'brute_force_max_attempts' },
    });
    expect(setting.value).toBe(7);

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: {
        resourceId: batchId,
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
      },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('bulk update tek transaction: iki ayar birlikte uygulanır', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .patch('/api/v1/admin/system-settings/bulk')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        changes: [
          { key: 'rate_limit_login_per_minute', value: 8 },
          { key: 'rate_limit_intake_per_minute', value: 12 },
        ],
        reason: 'Rate limit profilleri test güncellemesi.',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    expect(proposeResponse.body.data.items).toHaveLength(2);

    const batchId = proposeResponse.body.data.batchId as string;

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/system-settings/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('checker.admin@ethics.local'))
      .send({ approved: true, reason: 'Bulk onay.' });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.appliedKeys).toEqual([
      'rate_limit_login_per_minute',
      'rate_limit_intake_per_minute',
    ]);

    const loginSetting = await environment.prisma.systemSetting.findUniqueOrThrow({
      where: { key: 'rate_limit_login_per_minute' },
    });
    const intakeSetting = await environment.prisma.systemSetting.findUniqueOrThrow({
      where: { key: 'rate_limit_intake_per_minute' },
    });

    expect(loginSetting.value).toBe(8);
    expect(intakeSetting.value).toBe(12);
  });

  it('invalid value aralığı → 400 ADMIN_SYSTEM_SETTING_INVALID_VALUE', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/system-settings/session_idle_timeout_minutes')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        value: 3,
        reason: 'Geçersiz düşük değer denemesi.',
      });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body.error.code).toBe(ErrorCode.ADMIN_SYSTEM_SETTING_INVALID_VALUE);
  });
});
