import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { CaseField, FieldVisibility } from '@ethics/policy';
import { AuditEventType, ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
import { UserFactory, seedRoleTestUsers } from '@ethics/test-fixtures';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SafeLoggerService } from '../../../audit/safe-logger.service.js';
import { FieldMaskingService } from '../../../authorization/field-masking.service.js';
import { FieldVisibilityPolicyService } from '../../../authorization/field-visibility-policy.service.js';
import { PolicyGuardService } from '../../../authorization/policy-guard.service.js';
import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import { PolicyGuard } from '../../../common/guards/policy.guard.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import type { MaskableCaseData } from '../../../authorization/field-masking.types.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { ActionMatrixConfigService } from '../maker-checker/action-matrix-config.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import { FieldVisibilityAdminService } from '../config/field-visibility.service.js';
import { FieldVisibilityController } from '../config/field-visibility.controller.js';
import { ActionMatrixAdminService } from '../config/action-matrix.service.js';
import { ActionMatrixController } from '../config/action-matrix.controller.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Admin field visibility & action matrix DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let fieldVisibilityPolicy: FieldVisibilityPolicyService;
  let fieldMasking: FieldMaskingService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

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
      controllers: [FieldVisibilityController, ActionMatrixController],
      providers: [
        FieldVisibilityAdminService,
        ActionMatrixAdminService,
        FieldVisibilityPolicyService,
        FieldMaskingService,
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

    fieldVisibilityPolicy = moduleRef.get(FieldVisibilityPolicyService);
    fieldMasking = moduleRef.get(FieldMaskingService);
    await fieldVisibilityPolicy.reload();

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

  function buildMockCase(): MaskableCaseData {
    return {
      id: 'case-test-1',
      case_number: 'EB-2026-0099',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      company_id: 'company-1',
      company_name: 'Test Company',
      category: 'corruption',
      status: 'pre_review',
      workflow_state: 'PRE_REVIEW',
      confidentiality_level: ClearanceLevel.SENSITIVE,
      report_text: 'Gizli bildirim metni',
      incident_description: 'Gizli olay açıklaması',
      reporter_identity: { name: 'Bildirimci' },
      reporter_contact: { email: 'reporter@example.com' },
      incident_date: '2025-12-01',
      incident_location: 'İstanbul',
      involved_persons: [{ name: 'Kişi A' }],
      witnesses: [{ name: 'Tanık B' }],
      attachments: [{ id: 'doc-1', name: 'ek.pdf' }],
      pre_research_notes: 'Ön araştırma',
      rapporteur_report: 'Raportör raporu',
      council_decision_draft: 'Taslak',
      council_decision_final: 'Nihai',
      action_letter: 'Mektup',
      action_response: 'Dönüş',
      secure_messages: [{ id: 'msg-1', body: 'Mesaj' }],
      assigned_rapporteur_id: 'rapporteur-1',
      assigned_action_owner_id: 'owner-1',
      available_actions: ['case:read'],
    };
  }

  it('normal user field visibility list → 403 AUTHZ_FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/field-visibility')
      .set('x-test-user-id', userIdFor('council.member@ethics.local'));

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('admin field visibility list → 200 matrix without plaintext content', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/field-visibility')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.roles).toContain(Role.ADMIN);
    expect(response.body.data.fields).toContain(CaseField.REPORT_TEXT);

    const adminReportText = response.body.data.matrix.find(
      (item: { roleCode: string; fieldName: string }) =>
        item.roleCode === Role.ADMIN && item.fieldName === CaseField.REPORT_TEXT,
    );

    expect(adminReportText.visibility).toBe(FieldVisibility.HIDDEN);
    expect(response.body.data).not.toHaveProperty('reportText');
  });

  it('admin content visibility proposal for admin role → 400 ADMIN_FIELD_VISIBILITY_ADMIN_PROTECTED', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/field-visibility')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        changes: [
          {
            roleCode: Role.ADMIN,
            fieldName: CaseField.REPORT_TEXT,
            visibility: FieldVisibility.VISIBLE,
          },
        ],
        reason: 'Admin içerik görmeli testi — reddedilmeli.',
      });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body.error.code).toBe(ErrorCode.ADMIN_FIELD_VISIBILITY_ADMIN_PROTECTED);
  });

  it('maker-checker + FieldMasking: council_member reporter_identity görünürlüğü güncellenir', async () => {
    const councilMemberUser = usersByEmail.get('council.member@ethics.local');
    if (!councilMemberUser) {
      throw new Error('Test user not found: council.member@ethics.local');
    }
    const councilMember = councilMemberUser;
    const source = buildMockCase();

    const beforeMask = fieldMasking.applyCaseFieldPolicy(councilMember, source);
    expect(beforeMask).not.toHaveProperty('reporter_identity');

    const proposeResponse = await request(app.getHttpServer())
      .patch('/api/v1/admin/field-visibility')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        changes: [
          {
            roleCode: Role.COUNCIL_MEMBER,
            fieldName: CaseField.REPORTER_IDENTITY,
            visibility: FieldVisibility.VISIBLE,
          },
        ],
        reason: 'Kurul üyesi kimlik erişimi test artışı.',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    const batchId = proposeResponse.body.data.batchId as string;

    const selfApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/field-visibility/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ approved: true, reason: 'Self approve denemesi.' });

    expect(selfApprove.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfApprove.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/field-visibility/batches/${batchId}/approve`)
      .set('x-test-user-id', userIdFor('checker.admin@ethics.local'))
      .send({ approved: true, reason: 'Onaylandı — test.' });

    expect(approveResponse.status).toBe(HttpStatus.OK);
    expect(approveResponse.body.data.status).toBe('APPROVED');

    await fieldVisibilityPolicy.reload();

    const afterMask = fieldMasking.applyCaseFieldPolicy(councilMember, source);
    expect(afterMask.reporter_identity).toEqual(source.reporter_identity);

    const adminUserRecord = usersByEmail.get('superadmin@ethics.local');
    if (!adminUserRecord) {
      throw new Error('Test user not found: superadmin@ethics.local');
    }
    const adminUser = adminUserRecord;
    const adminMask = fieldMasking.applyCaseFieldPolicy(adminUser, source);
    expect(adminMask).not.toHaveProperty('report_text');
    expect(adminMask).not.toHaveProperty('reporter_identity');

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: { eventType: AuditEventType.FIELD_VISIBILITY_CHANGED },
    });
    expect(auditEvents.length).toBeGreaterThan(0);
  });

  it('action matrix list → 200 + invalid role pair proposal → 400', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/action-matrix')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(listResponse.status).toBe(HttpStatus.OK);
    expect(listResponse.body.data.length).toBeGreaterThan(0);

    const invalidResponse = await request(app.getHttpServer())
      .patch('/api/v1/admin/action-matrix/role_assign')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        makerRole: Role.COUNCIL_SECRETARY,
        checkerRole: Role.ACTION_OWNER,
        reason: 'Geçersiz checker rolü testi.',
      });

    expect(invalidResponse.status).toBe(HttpStatus.BAD_REQUEST);
    expect(invalidResponse.body.error.code).toBe(ErrorCode.ADMIN_ACTION_MATRIX_INVALID_ROLES);
  });
});
