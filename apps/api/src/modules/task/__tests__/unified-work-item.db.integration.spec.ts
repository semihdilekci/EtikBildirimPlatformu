import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector, ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  ApprovalCategory,
  ApprovalWorkItemStatus,
  ApprovalWorkItemTargetType,
  AuditEventType,
  ClearanceLevel,
  ErrorCode,
  NotificationChannel,
  NotificationEventType,
  Role,
  WorkItemKind,
  type Role as RoleCode,
} from '@ethics/shared';
import { CaseField, FieldVisibility } from '@ethics/policy';
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
import { AdminUsersController } from '../../admin/users/admin-users.controller.js';
import { AdminUsersService } from '../../admin/users/admin-users.service.js';
import { MakerCheckerService } from '../../admin/maker-checker/maker-checker.service.js';
import { ApprovalWorkItemService } from '../../admin/maker-checker/approval-work-item.service.js';
import { createDefaultActionMatrixConfigService } from '../../admin/maker-checker/action-matrix-config.service.js';
import { ConfigService } from '../../admin/config/config.service.js';
import { FieldVisibilityAdminService } from '../../admin/config/field-visibility.service.js';
import { FieldVisibilityPolicyService } from '../../../authorization/field-visibility-policy.service.js';
import { SystemSettingsController } from '../../admin/config/system-settings.controller.js';
import { FieldVisibilityController } from '../../admin/config/field-visibility.controller.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { TaskController } from '../../task/task.controller.js';
import { TaskService } from '../../task/task.service.js';
import { UnifiedWorkItemService } from '../../task/unified-work-item.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import { NotificationService } from '../../../notification/notification.service.js';
import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import { BusinessCalendarService } from '../../task/sla/business-calendar.service.js';
import { SlaCalculatorService } from '../../task/sla/sla-calculator.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Unified work item / tasks decide integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let targetUserId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

    await environment.prisma.systemSetting.createMany({
      data: [
        { key: 'brute_force_max_attempts', value: 5, category: 'brute_force' },
        { key: 'session_idle_timeout_minutes', value: 30, category: 'session' },
      ],
      skipDuplicates: true,
    });

    const factory = new UserFactory(environment.prisma);
    const target = await factory.create({
      email: 'unified-work-item-target@ethics.local',
    });
    targetUserId = target.id;

    usersByEmail = new Map(
      await Promise.all(
        [
          'superadmin@ethics.local',
          'council.secretary@ethics.local',
          'council.member@ethics.local',
          'board.chair@ethics.local',
        ].map(async (email) => [email, await loadAuthenticatedUser(environment, email)] as const),
      ),
    );

    const prismaService = environment.prisma as unknown as PrismaService;
    const auditPublisher = new AuditEventPublisher();
    const policyScopeService = new PolicyScopeService();
    const notificationService = new NotificationService(new NotificationEventPublisher());
    const businessCalendarService = new BusinessCalendarService(prismaService);
    const slaCalculatorService = new SlaCalculatorService(businessCalendarService);
    const actionMatrixConfigService = createDefaultActionMatrixConfigService();
    const makerCheckerService = new MakerCheckerService(actionMatrixConfigService);
    const approvalWorkItemService = new ApprovalWorkItemService(
      prismaService,
      actionMatrixConfigService,
      notificationService,
    );
    const configService = new ConfigService(
      prismaService,
      auditPublisher,
      makerCheckerService,
      approvalWorkItemService,
    );
    const fieldVisibilityPolicyService = new FieldVisibilityPolicyService(prismaService);
    const fieldVisibilityAdminService = new FieldVisibilityAdminService(
      prismaService,
      auditPublisher,
      makerCheckerService,
      fieldVisibilityPolicyService,
      approvalWorkItemService,
    );
    const adminUsersService = new AdminUsersService(
      prismaService,
      auditPublisher,
      makerCheckerService,
      approvalWorkItemService,
    );
    const unifiedWorkItemService = new UnifiedWorkItemService(prismaService, policyScopeService);
    unifiedWorkItemService.wireAdminUsersServiceForTests(adminUsersService);
    unifiedWorkItemService.wireConfigServiceForTests(configService);
    unifiedWorkItemService.wireFieldVisibilityAdminServiceForTests(fieldVisibilityAdminService);
    const taskService = new TaskService(
      prismaService,
      policyScopeService,
      auditPublisher,
      slaCalculatorService,
      notificationService,
      { get: () => undefined } as unknown as ModuleRef,
      unifiedWorkItemService,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AdminUsersController,
        TaskController,
        SystemSettingsController,
        FieldVisibilityController,
      ],
      providers: [
        { provide: AdminUsersService, useValue: adminUsersService },
        { provide: ConfigService, useValue: configService },
        { provide: FieldVisibilityAdminService, useValue: fieldVisibilityAdminService },
        { provide: FieldVisibilityPolicyService, useValue: fieldVisibilityPolicyService },
        { provide: TaskService, useValue: taskService },
        { provide: UnifiedWorkItemService, useValue: unifiedWorkItemService },
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

    let activeUser = usersByEmail.get('council.secretary@ethics.local');
    if (!activeUser) {
      throw new Error('Test user not found: council.secretary@ethics.local');
    }

    app.use((req: Request, _res: Response, next: NextFunction) => {
      const headerUserId = req.headers['x-test-user-id'];
      if (typeof headerUserId === 'string') {
        const matched = [...usersByEmail.values()].find((user) => user.id === headerUserId);
        if (matched) {
          activeUser = matched;
        }
      }

      if (!activeUser) {
        throw new Error('Test user not resolved from x-test-user-id header');
      }

      (req as Request & { user?: { userId: string }; correlationId?: string }).user = {
        userId: activeUser.id,
      };
      (req as Request & { correlationId?: string }).correlationId = 'corr-unified-work-item-test';
      next();
    });
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await environment.teardown();
  }, 30_000);

  function userIdFor(email: string): string {
    const user = usersByEmail.get(email);
    if (!user) {
      throw new Error(`Test user not found: ${email}`);
    }
    return user.id;
  }

  it('admin propose rol → council secretary list + decide happy path', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.COUNCIL_MEMBER,
        reason: 'Unified work item integration test ataması.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    const roleId = assignResponse.body.data.id as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleId,
      },
    });

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .query({ kind: WorkItemKind.APPROVAL, status: ApprovalWorkItemStatus.PENDING })
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(listResponse.status).toBe(HttpStatus.OK);
    expect(
      listResponse.body.data.some(
        (row: { id: string; kind: string }) =>
          row.id === workItem.id && row.kind === WorkItemKind.APPROVAL,
      ),
    ).toBe(true);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${workItem.id}`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(detailResponse.status).toBe(HttpStatus.OK);
    expect(detailResponse.body.data.kind).toBe(WorkItemKind.APPROVAL);
    expect(detailResponse.body.data.canDecide).toBe(true);
    expect(detailResponse.body.data.targetType).toBe(ApprovalWorkItemTargetType.USER_ROLE);

    const decideResponse = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'Görev kuyruğundan onaylandı.' });

    expect(decideResponse.status).toBe(HttpStatus.OK);
    expect(decideResponse.body.data.workItem.status).toBe(ApprovalWorkItemStatus.COMPLETED);
    expect(decideResponse.body.data.domainResult.status).toBe('ACTIVE');

    const closed = await environment.prisma.approvalWorkItem.findUniqueOrThrow({
      where: { id: workItem.id },
    });
    expect(closed.status).toBe(ApprovalWorkItemStatus.COMPLETED);
    expect(closed.decidedBy).toBe(userIdFor('council.secretary@ethics.local'));

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: {
        resourceId: roleId,
        eventType: AuditEventType.ROLE_ASSIGNMENT_APPROVED,
      },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('maker self-decide via /tasks/:id/decide → 422 MAKER_CHECKER_SELF', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.ACTION_OWNER,
        reason: 'Self-decide deny testi.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    const roleId = assignResponse.body.data.id as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleId,
      },
    });

    const selfDecide = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ approved: true, reason: 'Kendi işlemimi onaylıyorum.' });

    expect(selfDecide.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfDecide.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);
  });

  it('system settings propose → council secretary list + decide happy path', async () => {
    const proposeResponse = await request(app.getHttpServer())
      .patch('/api/v1/admin/system-settings/brute_force_max_attempts')
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        value: 9,
        reason: 'Unified work item system settings testi.',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    const batchId = proposeResponse.body.data.batchId as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.SYSTEM_SETTING_BATCH,
        targetId: batchId,
      },
    });
    expect(workItem.category).toBe(ApprovalCategory.SYSTEM_SETTING_CHANGE);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .query({ kind: WorkItemKind.APPROVAL, status: ApprovalWorkItemStatus.PENDING })
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(listResponse.status).toBe(HttpStatus.OK);
    expect(
      listResponse.body.data.some(
        (row: { id: string; kind: string }) =>
          row.id === workItem.id && row.kind === WorkItemKind.APPROVAL,
      ),
    ).toBe(true);

    const decideResponse = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'Sistem ayarı görev kuyruğundan onaylandı.' });

    expect(decideResponse.status).toBe(HttpStatus.OK);
    expect(decideResponse.body.data.workItem.status).toBe(ApprovalWorkItemStatus.COMPLETED);
    expect(decideResponse.body.data.domainResult.status).toBe('APPROVED');

    const setting = await environment.prisma.systemSetting.findUniqueOrThrow({
      where: { key: 'brute_force_max_attempts' },
    });
    expect(setting.value).toBe(9);

    const auditEvents = await environment.prisma.auditOutbox.findMany({
      where: {
        resourceId: batchId,
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
      },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('field visibility propose → council secretary list + decide happy path', async () => {
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
        reason: 'Unified work item field visibility testi.',
      });

    expect(proposeResponse.status).toBe(HttpStatus.OK);
    const batchId = proposeResponse.body.data.batchId as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.FIELD_VISIBILITY_BATCH,
        targetId: batchId,
      },
    });
    expect(workItem.category).toBe(ApprovalCategory.FIELD_VISIBILITY_CHANGE);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${workItem.id}`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(detailResponse.status).toBe(HttpStatus.OK);
    expect(detailResponse.body.data.targetType).toBe(
      ApprovalWorkItemTargetType.FIELD_VISIBILITY_BATCH,
    );
    expect(detailResponse.body.data.canDecide).toBe(true);

    const decideResponse = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'Alan görünürlüğü görev kuyruğundan onaylandı.' });

    expect(decideResponse.status).toBe(HttpStatus.OK);
    expect(decideResponse.body.data.workItem.status).toBe(ApprovalWorkItemStatus.COMPLETED);
    expect(decideResponse.body.data.domainResult.status).toBe('APPROVED');

    const config = await environment.prisma.fieldVisibilityConfig.findUnique({
      where: {
        roleCode_fieldName: {
          roleCode: Role.COUNCIL_MEMBER,
          fieldName: CaseField.REPORTER_IDENTITY,
        },
      },
    });
    expect(config?.visibility).toBe(FieldVisibility.VISIBLE);
  });

  it('rol proposal → checker rol havuzuna in-app notification outbox', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.RAPPORTEUR,
        reason: 'Notification outbox integration testi.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    const roleId = assignResponse.body.data.id as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleId,
      },
    });

    const events = await environment.prisma.notificationEvent.findMany({
      where: {
        eventType: NotificationEventType.APPROVAL_WORK_ITEM_ASSIGNED,
        channel: NotificationChannel.IN_APP,
        recipientUserId: userIdFor('council.secretary@ethics.local'),
      },
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((event) => event.idempotencyKey?.includes(workItem.id))).toBe(true);
  });

  it('wrong checker rolü admin approve → 403 MAKER_CHECKER_FORBIDDEN', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.BOARD_CHAIR,
        reason: 'Wrong checker deny testi.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    const roleId = assignResponse.body.data.id as string;

    const wrongCheckerApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles/${roleId}/approve`)
      .set('x-test-user-id', userIdFor('board.chair@ethics.local'))
      .send({ approved: true, reason: 'Yetkisiz onay denemesi.' });

    expect(wrongCheckerApprove.status).toBe(HttpStatus.FORBIDDEN);
    expect(wrongCheckerApprove.body.error.code).toBe(ErrorCode.MAKER_CHECKER_FORBIDDEN);
  });

  it('idempotent decide → ikinci /tasks/:id/decide 409 APPROVAL_WORK_ITEM_ALREADY_DECIDED', async () => {
    const factory = new UserFactory(environment.prisma);
    const idempotentTarget = await factory.create({
      email: 'unified-work-item-idempotent@ethics.local',
    });

    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${idempotentTarget.id}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.COUNCIL_CHAIR,
        reason: 'Idempotent decide testi.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    const roleId = assignResponse.body.data.id as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleId,
      },
    });

    const firstDecide = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'İlk karar.' });

    expect(firstDecide.status).toBe(HttpStatus.OK);

    const secondDecide = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'İkinci karar denemesi.' });

    expect(secondDecide.status).toBe(HttpStatus.CONFLICT);
    expect(secondDecide.body.error.code).toBe(ErrorCode.APPROVAL_WORK_ITEM_ALREADY_DECIDED);
  });
});

async function loadAuthenticatedUser(
  environment: PostgresTestEnvironment,
  email: string,
): Promise<AuthenticatedUser> {
  const user = await environment.prisma.user.findFirstOrThrow({
    where: { email },
    include: {
      company: { select: { id: true, name: true } },
      rolesAssigned: { where: { isActive: true } },
    },
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.rolesAssigned.map((role) => role.roleCode as RoleCode),
    clearanceLevel: user.clearanceLevel as ClearanceLevel,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    functionId: user.functionId,
    locationId: user.locationId,
    isGeneralSecretary: user.isGeneralSecretary,
  };
}
