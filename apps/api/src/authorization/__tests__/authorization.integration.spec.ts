import { Controller, Get, HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
import { PermissionCode, roleHasPermission } from '@ethics/policy';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { SafeLoggerService } from '../../audit/safe-logger.service.js';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter.js';
import { PolicyGuardService } from '../policy-guard.service.js';
import { PolicyGuard } from '../../common/guards/policy.guard.js';
import { SessionAuthGuard } from '../../modules/auth/guards/session-auth.guard.js';
import { AuthService } from '../../modules/auth/auth.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';

@Controller('authz-matrix')
class AuthorizationMatrixController {
  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @Get('admin-manage-roles')
  adminManageRoles() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.SECURE_MESSAGE_READ)
  @Get('secure-message-read')
  secureMessageRead() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.CASE_LIST)
  @Get('case-list')
  caseList() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.BOARD_APPROVE_OR_VETO)
  @Get('board-approve')
  boardApprove() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.ACTION_RESPOND)
  @Get('action-respond')
  actionRespond() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.CASE_ASSIGN_RAPPORTEUR)
  @Get('case-assign-rapporteur')
  caseAssignRapporteur() {
    return { data: { ok: true } };
  }
}

type RoleMatrixCase = {
  role: Role;
  clearanceLevel: ClearanceLevel;
  granted: PermissionCode;
  denied: PermissionCode;
};

const ROLE_MATRIX: readonly RoleMatrixCase[] = [
  {
    role: Role.COUNCIL_SECRETARY,
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    granted: PermissionCode.SECURE_MESSAGE_READ,
    denied: PermissionCode.ADMIN_MANAGE_ROLES,
  },
  {
    role: Role.COUNCIL_CHAIR,
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    granted: PermissionCode.CASE_LIST,
    denied: PermissionCode.SECURE_MESSAGE_READ,
  },
  {
    role: Role.COUNCIL_MEMBER,
    clearanceLevel: ClearanceLevel.SENSITIVE,
    granted: PermissionCode.CASE_LIST,
    denied: PermissionCode.CASE_ASSIGN_RAPPORTEUR,
  },
  {
    role: Role.BOARD_CHAIR,
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    granted: PermissionCode.BOARD_APPROVE_OR_VETO,
    denied: PermissionCode.SECURE_MESSAGE_READ,
  },
  {
    role: Role.RAPPORTEUR,
    clearanceLevel: ClearanceLevel.SENSITIVE,
    granted: PermissionCode.CASE_LIST,
    denied: PermissionCode.SECURE_MESSAGE_READ,
  },
  {
    role: Role.ACTION_OWNER,
    clearanceLevel: ClearanceLevel.NORMAL,
    granted: PermissionCode.ACTION_RESPOND,
    denied: PermissionCode.ADMIN_MANAGE_ROLES,
  },
  {
    role: Role.ADMIN,
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    granted: PermissionCode.ADMIN_MANAGE_ROLES,
    denied: PermissionCode.SECURE_MESSAGE_READ,
  },
];

const PERMISSION_ROUTE: Partial<Record<PermissionCode, string>> = {
  [PermissionCode.ADMIN_MANAGE_ROLES]: '/authz-matrix/admin-manage-roles',
  [PermissionCode.SECURE_MESSAGE_READ]: '/authz-matrix/secure-message-read',
  [PermissionCode.CASE_LIST]: '/authz-matrix/case-list',
  [PermissionCode.BOARD_APPROVE_OR_VETO]: '/authz-matrix/board-approve',
  [PermissionCode.ACTION_RESPOND]: '/authz-matrix/action-respond',
  [PermissionCode.CASE_ASSIGN_RAPPORTEUR]: '/authz-matrix/case-assign-rapporteur',
};

function buildUser(role: Role, clearanceLevel: ClearanceLevel): AuthenticatedUser {
  return {
    id: `seed-${role}`,
    email: `${role}@ethics.local`,
    displayName: `Seed ${role}`,
    roles: [role],
    clearanceLevel,
    companyId: role === Role.ACTION_OWNER ? 'seed-company-1' : null,
    companyName: role === Role.ACTION_OWNER ? 'Sentetik Seed Şirketi' : null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: role === Role.COUNCIL_SECRETARY,
  };
}

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Authorization integration (endpoint × rol matrisi)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  async function createApp(activeUser: AuthenticatedUser): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthorizationMatrixController],
      providers: [
        Reflector,
        PolicyGuardService,
        PolicyGuard,
        {
          provide: AuthService,
          useValue: {
            loadAuthenticatedUser: (userId: string) =>
              Promise.resolve(activeUser.id === userId ? activeUser : null),
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
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));

    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { userId: activeUser.id };
      next();
    });

    await app.init();
  }

  it.each(ROLE_MATRIX)(
    '$role granted permission → 200',
    async ({ role, clearanceLevel, granted }) => {
      expect(roleHasPermission(role, granted)).toBe(true);

      await createApp(buildUser(role, clearanceLevel));

      const route = PERMISSION_ROUTE[granted];
      expect(route).toBeDefined();
      if (!route) {
        return;
      }

      const response = await request(app.getHttpServer()).get(route);
      expect(response.status).toBe(HttpStatus.OK);
    },
  );

  it.each(ROLE_MATRIX)(
    '$role denied permission → 403 AUTHZ_FORBIDDEN',
    async ({ role, clearanceLevel, denied }) => {
      expect(roleHasPermission(role, denied)).toBe(false);

      await createApp(buildUser(role, clearanceLevel));

      const route = PERMISSION_ROUTE[denied];
      expect(route).toBeDefined();
      if (!route) {
        return;
      }

      const response = await request(app.getHttpServer()).get(route);
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
    },
  );

  it('rolsüz kullanıcı tüm korumalı endpointlerde 403 alır', async () => {
    const rolelessUser: AuthenticatedUser = {
      id: 'jit-roleless',
      email: 'jit.roleless@ethics.local',
      displayName: 'JIT Roleless',
      roles: [],
      clearanceLevel: ClearanceLevel.NORMAL,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };

    await createApp(rolelessUser);

    for (const route of Object.values(PERMISSION_ROUTE)) {
      const response = await request(app.getHttpServer()).get(route);
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
    }
  });

  it('clearance yetersiz kullanıcı PolicyGuardService üzerinden reddedilir', () => {
    const service = new PolicyGuardService();
    const user = buildUser(Role.COUNCIL_SECRETARY, ClearanceLevel.NORMAL);

    const result = service.evaluate(user, PermissionCode.CASE_READ, {
      resourceClearanceLevel: ClearanceLevel.SENSITIVE,
    });

    expect(result).toEqual({ allowed: false, reason: 'clearance_denied' });
  });
});
