import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuditEventType, ClearanceLevel, ErrorCode, MasterDataType, Role } from '@ethics/shared';
import { seedRoleTestUsers } from '@ethics/test-fixtures';
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
import { AdminMasterDataController } from '../master-data/admin-master-data.controller.js';
import { AdminMasterDataService } from '../master-data/admin-master-data.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin master data DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let seedCompanyId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    const seedResult = await seedRoleTestUsers(environment.prisma);
    if (!seedResult.companyId) {
      throw new Error('Seed company ID bulunamadı.');
    }
    seedCompanyId = seedResult.companyId;

    usersByEmail = new Map(
      await Promise.all(
        ['superadmin@ethics.local', 'council.member@ethics.local'].map(
          async (email) => [email, await loadAuthenticatedUser(environment, email)] as const,
        ),
      ),
    );

    const prismaService = environment.prisma as unknown as PrismaService;
    const seedSuperAdmin = usersByEmail.get('superadmin@ethics.local');
    if (!seedSuperAdmin) {
      throw new Error('Test user not found: superadmin@ethics.local');
    }
    let activeUser = seedSuperAdmin;

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminMasterDataController],
      providers: [
        AdminMasterDataService,
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

  it('invalid master data type → 400 ADMIN_MASTER_DATA_TYPE_INVALID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/master-data/invalid-type')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body.error.code).toBe(ErrorCode.ADMIN_MASTER_DATA_TYPE_INVALID);
  });

  it('normal user master data list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/master-data/company')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('company CRUD + audit events', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/master-data/company')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        name: 'Test Admin Şirketi',
        code: 'ADM-CO-01',
      });

    expect(createResponse.status).toBe(HttpStatus.CREATED);
    expect(createResponse.body.data.type).toBe(MasterDataType.COMPANY);
    expect(createResponse.body.data.isActive).toBe(true);

    const companyId = createResponse.body.data.id as string;

    const patchResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/master-data/company/${companyId}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ name: 'Test Admin Şirketi Güncel' });

    expect(patchResponse.status).toBe(HttpStatus.OK);
    expect(patchResponse.body.data.name).toBe('Test Admin Şirketi Güncel');

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/v1/admin/master-data/company/${companyId}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(deleteResponse.status).toBe(HttpStatus.OK);
    expect(deleteResponse.body.data.isActive).toBe(false);

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: {
        resourceId: companyId,
        eventType: {
          in: [
            AuditEventType.MASTER_DATA_CREATED,
            AuditEventType.MASTER_DATA_UPDATED,
            AuditEventType.MASTER_DATA_DELETED,
          ],
        },
      },
    });

    expect(auditEvents.length).toBeGreaterThanOrEqual(3);
  });

  it.each([MasterDataType.LOCATION, MasterDataType.FUNCTION, MasterDataType.POSITION] as const)(
    '%s scoped CRUD happy path',
    async (type) => {
      const code = `${type.slice(0, 3).toUpperCase()}-01`;

      const createResponse = await request(app.getHttpServer())
        .post(`/api/v1/admin/master-data/${type}`)
        .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
        .send({
          companyId: seedCompanyId,
          name: `Test ${type}`,
          code,
        });

      expect(createResponse.status).toBe(HttpStatus.CREATED);
      expect(createResponse.body.data.type).toBe(type);
      expect(createResponse.body.data.companyId).toBe(seedCompanyId);

      const recordId = createResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/admin/master-data/${type}`)
        .query({ companyId: seedCompanyId })
        .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

      expect(listResponse.status).toBe(HttpStatus.OK);
      expect(listResponse.body.data.some((item: { id: string }) => item.id === recordId)).toBe(
        true,
      );

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/admin/master-data/${type}/${recordId}`)
        .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

      expect(deleteResponse.status).toBe(HttpStatus.OK);
      expect(deleteResponse.body.data.isActive).toBe(false);
    },
  );

  it('duplicate code → 409 ADMIN_MASTER_DATA_CODE_CONFLICT', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/master-data/company')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        name: 'Duplicate Code Co',
        code: 'DUP-CO-01',
      });

    expect(createResponse.status).toBe(HttpStatus.CREATED);

    const duplicateResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/master-data/company')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        name: 'Duplicate Code Co 2',
        code: 'DUP-CO-01',
      });

    expect(duplicateResponse.status).toBe(HttpStatus.CONFLICT);
    expect(duplicateResponse.body.error.code).toBe(ErrorCode.ADMIN_MASTER_DATA_CODE_CONFLICT);
  });

  it('admin sync-runs list → 200 with metadata only', async () => {
    const startedAt = new Date('2026-06-09T02:00:00.000Z');
    const finishedAt = new Date('2026-06-09T02:05:00.000Z');

    await environment.prisma.hrSyncRun.create({
      data: {
        syncType: 'FULL',
        status: 'COMPLETED',
        startedAt,
        finishedAt,
        recordsProcessed: 1250,
        recordsCreated: 10,
        recordsUpdated: 40,
        recordsDeactivated: 2,
      },
    });

    await environment.prisma.hrSyncRun.create({
      data: {
        syncType: 'DELTA',
        status: 'FAILED',
        startedAt: new Date('2026-06-08T02:00:00.000Z'),
        finishedAt: new Date('2026-06-08T02:01:00.000Z'),
        recordsProcessed: 0,
        errorCode: 'HR_SYNC_CONNECTION_TIMEOUT',
        errorDetailMasked: '[REDACTED] Bağlantı zaman aşımı',
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/master-data/sync-runs')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data).toHaveLength(2);

    const latestRun = response.body.data[0];
    expect(latestRun).toMatchObject({
      integrationName: 'HR_SAP_USER_SYNC',
      status: 'COMPLETED',
      recordCount: 1250,
      errorCount: 0,
    });
    expect(latestRun.startedAt).toBe(startedAt.toISOString());
    expect(latestRun.finishedAt).toBe(finishedAt.toISOString());
    expect(latestRun.errorDetailMasked).toBeNull();

    const failedRun = response.body.data[1];
    expect(failedRun.status).toBe('FAILED');
    expect(failedRun.errorCount).toBe(1);
    expect(failedRun.errorDetailMasked).toContain('[REDACTED]');

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/@ethics\.local/i);
    expect(serialized).not.toMatch(/password/i);
  });

  it('normal user sync-runs list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/master-data/sync-runs')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });
});
