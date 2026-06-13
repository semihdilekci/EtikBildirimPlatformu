import { Controller, Get, HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { Authenticated } from '../../decorators/authenticated.decorator.js';
import { Public } from '../../decorators/public.decorator.js';
import { RequirePolicy } from '../../decorators/require-policy.decorator.js';
import { GlobalExceptionFilter } from '../../filters/global-exception.filter.js';
import { PolicyGuardService } from '../../../authorization/policy-guard.service.js';
import { PolicyGuard } from '../policy.guard.js';
import { SessionAuthGuard } from '../../../modules/auth/guards/session-auth.guard.js';
import { AuthService } from '../../../modules/auth/auth.service.js';
import type { AuthenticatedUser } from '../../types/authenticated-user.type.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

@Controller('test-policy')
class PolicyTestController {
  @Public()
  @Get('public')
  publicRoute() {
    return { data: { ok: true } };
  }

  @Authenticated()
  @Get('authenticated')
  authenticatedRoute() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @Get('admin-only')
  adminOnlyRoute() {
    return { data: { ok: true } };
  }

  @RequirePolicy(PermissionCode.SECURE_MESSAGE_READ)
  @Get('secure-message')
  secureMessageRoute() {
    return { data: { ok: true } };
  }
}

describe('PolicyGuard', () => {
  let app: INestApplication;

  const adminUser: AuthenticatedUser = {
    id: 'admin-1',
    email: 'superadmin@ethics.local',
    displayName: 'Superadmin',
    roles: [Role.ADMIN],
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: true,
  };

  const rolelessUser: AuthenticatedUser = {
    id: 'jit-1',
    email: 'jit@example.com',
    displayName: 'JIT',
    roles: [],
    clearanceLevel: ClearanceLevel.NORMAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: false,
  };

  afterEach(async () => {
    await app.close();
  });

  async function createApp(activeUser: AuthenticatedUser | null): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PolicyTestController],
      providers: [
        Reflector,
        PolicyGuardService,
        PolicyGuard,
        {
          provide: AuthService,
          useValue: {
            loadAuthenticatedUser: (userId: string) =>
              Promise.resolve(activeUser !== null && activeUser.id === userId ? activeUser : null),
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
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));

    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (activeUser !== null) {
        req.user = { userId: activeUser.id };
      }
      next();
    });

    await app.init();
  }

  it('@Public route policy kontrolünden muaf', async () => {
    await createApp(null);

    const response = await request(app.getHttpServer()).get('/test-policy/public');

    expect(response.status).toBe(HttpStatus.OK);
  });

  it('rolsüz kullanıcı @RequirePolicy endpoint → 403 AUTHZ_FORBIDDEN', async () => {
    await createApp(rolelessUser);

    const response = await request(app.getHttpServer()).get('/test-policy/secure-message');

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('superadmin admin:manage_roles endpoint → 200', async () => {
    await createApp(adminUser);

    const response = await request(app.getHttpServer()).get('/test-policy/admin-only');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.ok).toBe(true);
  });

  it('superadmin secure_message:read için rbac_denied → 403', async () => {
    await createApp(adminUser);

    const response = await request(app.getHttpServer()).get('/test-policy/secure-message');

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
  });

  it('@Authenticated route policy kontrolü olmadan geçer', async () => {
    await createApp(rolelessUser);

    const response = await request(app.getHttpServer()).get('/test-policy/authenticated');

    expect(response.status).toBe(HttpStatus.OK);
  });
});
