import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  AuditEventType,
  BusinessCalendarDayType,
  DEFAULT_SLA_POLICIES,
  ErrorCode,
  Role,
  TaskType,
} from '@ethics/shared';
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
import { SlaPoliciesController } from '../sla/sla-policies.controller.js';
import { BusinessCalendarController } from '../sla/business-calendar.controller.js';
import { SlaPolicyAdminService } from '../sla/sla-policy-admin.service.js';
import { BusinessCalendarAdminService } from '../sla/business-calendar-admin.service.js';
import { BusinessCalendarService } from '../../task/sla/business-calendar.service.js';
import { SlaCalculatorService } from '../../task/sla/sla-calculator.service.js';
import { toIstanbulDateKey } from '../../task/sla/business-calendar.util.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin SLA + business calendar DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let slaCalculator: SlaCalculatorService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

    for (const policy of DEFAULT_SLA_POLICIES) {
      await environment.prisma.slaPolicyConfig.upsert({
        where: { taskType: policy.taskType },
        create: {
          taskType: policy.taskType,
          slaDuration: policy.slaDuration,
          slaUnit: policy.slaUnit,
          warningThresholdHours: policy.warningThresholdHours,
          escalationRole: policy.escalationRole,
        },
        update: {
          slaDuration: policy.slaDuration,
          slaUnit: policy.slaUnit,
          warningThresholdHours: policy.warningThresholdHours,
          escalationRole: policy.escalationRole,
          isActive: true,
        },
      });
    }

    const factory = new UserFactory(environment.prisma);
    const checkerAdmin = await factory.create({
      email: 'sla.checker.admin@ethics.local',
      displayName: 'SLA Checker Admin',
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
          'sla.checker.admin@ethics.local',
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

    slaCalculator = new SlaCalculatorService(new BusinessCalendarService(prismaService));

    const moduleRef = await Test.createTestingModule({
      controllers: [SlaPoliciesController, BusinessCalendarController],
      providers: [
        SlaPolicyAdminService,
        BusinessCalendarAdminService,
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

  it('normal user SLA list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/sla-policies')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('admin SLA list → 200 tüm görev tipleri', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/sla-policies')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data).toHaveLength(DEFAULT_SLA_POLICIES.length);
    expect(response.body.data[0]).toHaveProperty('taskType');
    expect(response.body.data[0]).toHaveProperty('slaDuration');
  });

  it('maker-checker happy path: SLA propose → approve → policy updated', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/sla-policies/${TaskType.SECRETARIAT_REVIEW_TASK}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        slaDuration: 5,
        reason: 'Sekreterya inceleme SLA test artışı.',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    expect(proposeResponse.body.data.status).toBe('PENDING');

    const batchId = proposeResponse.body.data.batchId as string;

    const selfApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/sla-policies/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ approved: true, reason: 'Self approve denemesi.' });

    expect(selfApprove.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfApprove.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/sla-policies/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('sla.checker.admin@ethics.local'))
      .send({ approved: true, reason: 'Onaylandı.' });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('APPROVED');
    expect(approveResponse.body.data.appliedTaskTypes).toContain(TaskType.SECRETARIAT_REVIEW_TASK);

    const policy = await environment.prisma.slaPolicyConfig.findUniqueOrThrow({
      where: { taskType: TaskType.SECRETARIAT_REVIEW_TASK },
    });
    expect(policy.slaDuration).toBe(5);

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: {
        resourceId: batchId,
        eventType: AuditEventType.SLA_POLICY_CHANGED,
      },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('business calendar: tatil ekle → BusinessCalendarService SLA hesabında atlar', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/business-calendar')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        date: '2025-03-10',
        dayType: BusinessCalendarDayType.OFFICIAL_HOLIDAY,
        description: 'Integration test resmi tatil',
        reason: 'SLA tatil atlama testi.',
      });

    expect(createResponse.status).toBe(HttpStatus.CREATED);
    expect(createResponse.body.data.date).toBe('2025-03-10');

    const assignedAt = new Date('2025-03-07T10:00:00+03:00');

    const result = await environment.prisma.$transaction((tx) =>
      slaCalculator.calculateDueAt(tx, TaskType.ACTION_RESPONSE_TASK, assignedAt),
    );

    expect(toIstanbulDateKey(result.dueAt)).toBe('2025-03-27');
  });

  it('business calendar: kayıt sil → soft delete', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/business-calendar')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        date: '2025-04-01',
        dayType: BusinessCalendarDayType.COMPANY_HOLIDAY,
        description: 'Silinecek holding tatili',
        reason: 'Silme testi.',
      });

    expect(createResponse.status).toBe(HttpStatus.CREATED);
    const entryId = createResponse.body.data.id as string;

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/v1/admin/business-calendar/${entryId}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ reason: 'Test silme.' });

    expect(deleteResponse.status).toBe(HttpStatus.OK);

    const entry = await environment.prisma.businessCalendarEntry.findUniqueOrThrow({
      where: { id: entryId },
    });
    expect(entry.isActive).toBe(false);
  });

  it('aynı tarihe ikinci tatil → 409 ADMIN_BUSINESS_CALENDAR_DATE_CONFLICT', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/business-calendar')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        date: '2025-05-01',
        dayType: BusinessCalendarDayType.OFFICIAL_HOLIDAY,
        description: 'İlk kayıt',
        reason: 'Çakışma testi.',
      });

    const duplicateResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/business-calendar')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        date: '2025-05-01',
        dayType: BusinessCalendarDayType.HALF_DAY,
        description: 'İkinci kayıt',
        reason: 'Çakışma testi tekrar.',
      });

    expect(duplicateResponse.status).toBe(HttpStatus.CONFLICT);
    expect(duplicateResponse.body.error.code).toBe(ErrorCode.ADMIN_BUSINESS_CALENDAR_DATE_CONFLICT);
  });
});
