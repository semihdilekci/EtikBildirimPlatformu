import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ClearanceLevel,
  ErrorCode,
  MalwareScanStatus,
  Role,
} from '@ethics/shared';
import { seedRoleTestUsers } from '@ethics/test-fixtures';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditSealService } from '../../../audit/audit-seal.service.js';
import { RedactionService } from '../../../audit/redaction.service.js';
import { SafeLoggerService } from '../../../audit/safe-logger.service.js';
import { PolicyGuardService } from '../../../authorization/policy-guard.service.js';
import { EnvService } from '../../../common/config/env.service.js';
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
import { AuditViewerController } from '../monitoring/audit-viewer.controller.js';
import { DocumentOpsAdminController } from '../monitoring/document-ops-admin.controller.js';
import { SystemHealthAdminController } from '../monitoring/system-health-admin.controller.js';
import { AuditViewerService } from '../monitoring/audit-viewer.service.js';
import { DocumentOpsAdminService } from '../monitoring/document-ops-admin.service.js';
import { SystemHealthAdminService } from '../monitoring/system-health-admin.service.js';
import { OBJECT_STORAGE_PORT } from '../../../storage/object-storage.port.js';
import { LocalObjectStorageAdapter } from '../../../storage/local-object-storage.adapter.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin monitoring DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let objectStorage: LocalObjectStorageAdapter;
  let auditViewerService: AuditViewerService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

    objectStorage = new LocalObjectStorageAdapter();

    await environment.prisma.auditEvent.create({
      data: {
        occurredAt: new Date(),
        eventType: AuditEventType.CASE_VIEWED,
        eventCategory: 'WORKFLOW',
        severity: 'INFO',
        actorType: AuditActorType.USER,
        actorId: 'actor-integration-1',
        action: 'case_viewed',
        outcome: AuditOutcome.SUCCESS,
        correlationId: crypto.randomUUID(),
        metadataJson: {
          resourceType: 'case',
          resourceId: 'case-monitor-1',
          policyDecisionId: 'pd-123',
        },
      },
    });

    await environment.prisma.auditEvent.create({
      data: {
        occurredAt: new Date(),
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
        eventCategory: 'CONFIG',
        severity: 'HIGH',
        actorType: AuditActorType.USER,
        actorId: 'actor-integration-1',
        action: 'system_setting_changed',
        outcome: AuditOutcome.SUCCESS,
        metadataJson: {
          resourceType: 'config',
          resourceId: 'setting-1',
          reason_text: 'Gizli karar metni',
        },
      },
    });

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
      controllers: [AuditViewerController, DocumentOpsAdminController, SystemHealthAdminController],
      providers: [
        AuditViewerService,
        DocumentOpsAdminService,
        SystemHealthAdminService,
        AuditSealService,
        RedactionService,
        {
          provide: EnvService,
          useValue: {
            isProduction: false,
            logRedactionEnabled: true,
          },
        },
        { provide: PrismaService, useValue: prismaService },
        { provide: OBJECT_STORAGE_PORT, useValue: objectStorage },
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
        { provide: APP_GUARD, useExisting: SessionAuthGuard },
        { provide: APP_GUARD, useExisting: PolicyGuard },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: SafeLoggerService, useValue: createSafeLoggerMock() },
      ],
    }).compile();

    auditViewerService = moduleRef.get(AuditViewerService);
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

  it('normal user audit events list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-events')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('admin audit events list → metadata redacted, no plaintext reason_text', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-events')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.items.length).toBeGreaterThan(0);

    const event = response.body.data.items.find(
      (item: { metadata?: { reason_text?: string } }) => item.metadata?.reason_text !== undefined,
    );

    expect(event).toBeDefined();
    expect(event.metadata.reason_text).toBe('[REDACTED]');
    expect(JSON.stringify(event)).not.toContain('Gizli karar metni');
  });

  it('admin audit CSV export async job → presigned download URL', async () => {
    const exportResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/audit-events/export')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ reason: 'Denetim kayıtları periyodik export testi.' });

    expect(exportResponse.status).toBe(HttpStatus.ACCEPTED);
    const jobId = exportResponse.body.data.id as string;

    await auditViewerService.processExportJob(jobId);

    const statusResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit-events/export/${jobId}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(statusResponse.status).toBe(HttpStatus.OK);
    expect(statusResponse.body.data.status).toBe('COMPLETED');
    expect(statusResponse.body.data.downloadUrl).toMatch(/^local-storage:\/\/get\//);
    expect(statusResponse.body.data.rowCount).toBeGreaterThan(0);
  });

  it('admin audit chain verify → valid chain', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/audit-events/verify-chain')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.valid).toBe(true);
    expect(response.body.data.eventCount).toBeGreaterThan(0);
  });

  it('admin system-health → database UP and outbox metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/system-health')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(
      response.body.data.components.find((c: { name: string }) => c.name === 'database').status,
    ).toBe('UP');
    expect(response.body.data.outboxDepth).toMatchObject({
      auditPending: expect.any(Number),
      auditFailed: expect.any(Number),
      notificationPending: expect.any(Number),
      notificationFailed: expect.any(Number),
    });
    expect(response.body.data.workers.length).toBeGreaterThan(0);
  });

  it('admin document-operations → metadata only summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/document-operations')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.summary).toMatchObject({
      totalDocuments: expect.any(Number),
      pendingScanCount: expect.any(Number),
      quarantinedCount: expect.any(Number),
      rejectedCount: expect.any(Number),
      cleanCount: expect.any(Number),
    });
    expect(response.body.data.items).toEqual(expect.any(Array));

    if (response.body.data.items.length > 0) {
      const item = response.body.data.items[0];
      expect(item).not.toHaveProperty('title');
      expect(item).not.toHaveProperty('content');
      expect(item.contentSha256Prefix.length).toBeGreaterThan(0);
      expect(Object.values(MalwareScanStatus)).toContain(item.malwareScanStatus);
    }
  });
});
