import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector, ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  ApprovalCategory,
  ApprovalWorkItemStatus,
  ApprovalWorkItemTargetType,
  ClearanceLevel,
  ErrorCode,
  Role,
  WorkItemKind,
  type Role as RoleCode,
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
import { AdminUsersController } from '../../admin/users/admin-users.controller.js';
import { AdminUsersService } from '../../admin/users/admin-users.service.js';
import { MakerCheckerService } from '../../admin/maker-checker/maker-checker.service.js';
import { ApprovalWorkItemService } from '../../admin/maker-checker/approval-work-item.service.js';
import { createDefaultActionMatrixConfigService } from '../../admin/maker-checker/action-matrix-config.service.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { TaskController } from '../task.controller.js';
import { TaskService } from '../task.service.js';
import { UnifiedWorkItemService } from '../unified-work-item.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import { NotificationService } from '../../../notification/notification.service.js';
import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import { BusinessCalendarService } from '../sla/business-calendar.service.js';
import { SlaCalculatorService } from '../sla/sla-calculator.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

/**
 * E2E journey: Docs/08 §12 Akış 6 — admin rol proposal → council secretary /tasks → decide → rol ACTIVE.
 */
describe('Checker approval work item E2E journey (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let app: INestApplication;
  let usersByEmail: Map<string, AuthenticatedUser>;
  let targetUserId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    await seedRoleTestUsers(environment.prisma);

    const factory = new UserFactory(environment.prisma);
    const target = await factory.create({
      email: 'flow6-journey-target@ethics.local',
    });
    targetUserId = target.id;

    usersByEmail = new Map(
      await Promise.all(
        ['superadmin@ethics.local', 'council.secretary@ethics.local'].map(
          async (email) => [email, await loadAuthenticatedUser(environment, email)] as const,
        ),
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
    const adminUsersService = new AdminUsersService(
      prismaService,
      auditPublisher,
      makerCheckerService,
      approvalWorkItemService,
    );
    const unifiedWorkItemService = new UnifiedWorkItemService(prismaService, policyScopeService);
    unifiedWorkItemService.wireAdminUsersServiceForTests(adminUsersService);
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
      controllers: [AdminUsersController, TaskController],
      providers: [
        { provide: AdminUsersService, useValue: adminUsersService },
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
        { provide: APP_GUARD, useExisting: SessionAuthGuard },
        { provide: APP_GUARD, useExisting: PolicyGuard },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: SafeLoggerService, useValue: createSafeLoggerMock() },
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
      (req as Request & { correlationId?: string }).correlationId = 'corr-flow6-journey';
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

  it('Akış 6: admin propose → secretary /tasks → decide → rol ACTIVE + maker self-decide deny', async () => {
    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/roles`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({
        roleCode: Role.COUNCIL_MEMBER,
        reason: 'Akış 6 journey rol ataması.',
      });

    expect(assignResponse.status).toBe(HttpStatus.CREATED);
    expect(assignResponse.body.data.status).toBe('PENDING_APPROVAL');
    const roleId = assignResponse.body.data.id as string;

    const workItem = await environment.prisma.approvalWorkItem.findFirstOrThrow({
      where: {
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleId,
        status: ApprovalWorkItemStatus.PENDING,
      },
    });
    expect(workItem.category).toBe(ApprovalCategory.ROLE_ASSIGNMENT);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .query({ kind: WorkItemKind.APPROVAL, status: ApprovalWorkItemStatus.PENDING })
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(listResponse.status).toBe(HttpStatus.OK);
    const approvalRow = listResponse.body.data.find(
      (row: { id: string; kind: string; approvalCategory?: string }) =>
        row.id === workItem.id && row.kind === WorkItemKind.APPROVAL,
    );
    expect(approvalRow).toBeDefined();
    expect(approvalRow.approvalCategory).toBe(ApprovalCategory.ROLE_ASSIGNMENT);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${workItem.id}`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'));

    expect(detailResponse.status).toBe(HttpStatus.OK);
    expect(detailResponse.body.data.canDecide).toBe(true);

    const selfDecide = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'))
      .send({ approved: true, reason: 'Maker self-decide denemesi.' });

    expect(selfDecide.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(selfDecide.body.error.code).toBe(ErrorCode.MAKER_CHECKER_SELF);

    const decideResponse = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${workItem.id}/decide`)
      .set('x-test-user-id', userIdFor('council.secretary@ethics.local'))
      .send({ approved: true, reason: 'Akış 6 journey onayı.' });

    expect(decideResponse.status).toBe(HttpStatus.OK);
    expect(decideResponse.body.data.workItem.status).toBe(ApprovalWorkItemStatus.COMPLETED);

    const userDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${targetUserId}`)
      .set('x-test-user-id', userIdFor('superadmin@ethics.local'));

    expect(userDetail.status).toBe(HttpStatus.OK);
    const activeRole = userDetail.body.data.roles.find(
      (role: { id: string; roleCode: string; status: string }) => role.id === roleId,
    );
    expect(activeRole?.status).toBe('ACTIVE');
    expect(activeRole?.roleCode).toBe(Role.COUNCIL_MEMBER);
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
