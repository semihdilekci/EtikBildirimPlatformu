import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuditEventType, ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
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
import { AdminUsersController } from '../users/admin-users.controller.js';
import { AdminUsersService } from '../users/admin-users.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import { ActionMatrixConfigService } from '../maker-checker/action-matrix-config.service.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin users DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let targetUserId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

    const factory = new UserFactory(environment.prisma);
    const target = await factory.create({
      email: 'admin-target.user@ethics.local',
      clearanceLevel: ClearanceLevel.SENSITIVE,
    });
    targetUserId = target.id;

    usersByEmail = new Map(
      await Promise.all(
        [
          'superadmin@ethics.local',
          'council.secretary@ethics.local',
          'council.chair@ethics.local',
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
      controllers: [AdminUsersController],
      providers: [
        AdminUsersService,
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
      clearanceLevel: user.clearanceLevel as ClearanceLevel,
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

  it('normal user admin users list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('admin users list → 200 metadata only', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).not.toHaveProperty('cases');
    expect(response.body.data[0]).toHaveProperty('clearanceLevel');
  });

  it('admin role assignment maker-checker happy path + audit', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.COUNCIL_MEMBER,
        reason: 'Kurul üyesi adayı test ataması.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    expect(assignResponse.body.data.status).toBe('PENDING_APPROVAL');

    const roleId = assignResponse.body.data.id as string;

    const selfApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles/${roleId}/approve`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ approved: true, reason: 'Self approve denemesi.' });

    expect(selfApprove.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfApprove.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles/${roleId}/approve`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'Onaylandı.' });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('ACTIVE');

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: {
        resourceId: roleId,
        eventType: {
          in: [AuditEventType.ROLE_ASSIGNMENT_REQUESTED, AuditEventType.ROLE_ASSIGNMENT_APPROVED],
        },
      },
    });

    expect(auditEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('STRICTLY_CONFIDENTIAL clearance yükseltme proposal + onay audit', async () => {
    const patchResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/clearance`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        reason: 'Kritik vaka erişimi için yükseltme.',
      });

    expect(patchResponse.status).toBe(HttpStatus.OK);
    expect(patchResponse.body.data.status).toBe('PENDING_APPROVAL');

    const requestId = patchResponse.body.data.requestId as string;

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/clearance/${requestId}/approve`)
      .set('x-test-user-id', userIdFor('council.chair@ethics.local'))
      .send({ approved: true, reason: 'Clearance onaylandı.' });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('UPDATED');

    const updatedUser = await environment.prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
    });

    expect(updatedUser.clearanceLevel).toBe(ClearanceLevel.STRICTLY_CONFIDENTIAL);

    const clearanceAudit = await environment.prisma.auditOutbox.findFirst({
      where: {
        eventType: AuditEventType.CLEARANCE_UPDATED,
        resourceId: targetUserId,
      },
    });

    expect(clearanceAudit).not.toBeNull();
  });
});
