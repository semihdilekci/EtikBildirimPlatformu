import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ErrorCode } from '@ethics/shared';
import { UserFactory } from '@ethics/test-fixtures';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PolicyGuardService } from '../../../authorization/policy-guard.service.js';
import { EnvService } from '../../../common/config/env.service.js';
import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import { PolicyGuard } from '../../../common/guards/policy.guard.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { SessionAuthGuard } from '../guards/session-auth.guard.js';
import { LoginAttemptService } from '../login-attempt.service.js';
import { AuthSessionSerializer } from '../session/auth-session.serializer.js';

describe('Auth DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let authService: AuthService;
  let loginAttemptService: LoginAttemptService;
  let app: INestApplication;

  const envService = {
    webAppUrl: 'http://localhost:5173',
    corsAllowedOrigins: ['http://localhost:5173'],
    oidcIssuerUrl: 'https://accounts.google.com',
    isProduction: false,
    ipHashPepper: 'test-pepper-min-16-chars',
    bruteForceMaxAttempts: 3,
    bruteForceLockoutMinutes: 15,
  } as EnvService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();

    authService = new AuthService(environment.prisma as never, envService);
    loginAttemptService = new LoginAttemptService(environment.prisma as never, envService);

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: LoginAttemptService, useValue: loginAttemptService },
        { provide: EnvService, useValue: envService },
        Reflector,
        PolicyGuardService,
        PolicyGuard,
        SessionAuthGuard,
        {
          provide: APP_GUARD,
          useExisting: SessionAuthGuard,
        },
        {
          provide: APP_GUARD,
          useExisting: PolicyGuard,
        },
        AuthSessionSerializer,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await environment.teardown();
  }, 30_000);

  it('JIT provisioning yeni kullanıcı oluşturur ve user_roles kaydı eklemez', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);

    const provisioned = await authService.provisionUserFromOidc({
      sub: `jit-sub-${suffix}`,
      email: `jit.user.${suffix}@ethics.local`,
      name: `JIT User ${suffix}`,
    });

    expect(provisioned.jitProvisioned).toBe(true);

    const roles = await environment.prisma.userRole.findMany({
      where: { userId: provisioned.id, isActive: true },
    });

    expect(roles).toEqual([]);
  });

  it('loadAuthenticatedUser pasif kullanıcı için null döner', async () => {
    const factory = new UserFactory(environment.prisma);
    const inactiveUser = await factory.create({ isActive: false });

    const loaded = await authService.loadAuthenticatedUser(inactiveUser.id);

    expect(loaded).toBeNull();
  });

  it('lockout sonrası assertNotLocked AUTH_BRUTE_FORCE_LOCKED fırlatır', async () => {
    const ipAddress = `10.0.${String(Math.floor(Math.random() * 200))}.${String(Math.floor(Math.random() * 200))}`;

    await loginAttemptService.recordFailure(ipAddress);
    await loginAttemptService.recordFailure(ipAddress);
    await loginAttemptService.recordFailure(ipAddress);

    await expect(loginAttemptService.assertNotLocked(ipAddress)).rejects.toMatchObject({
      code: ErrorCode.AUTH_BRUTE_FORCE_LOCKED,
    });
  });

  it('session olmadan /auth/me → 401 AUTH_SESSION_REQUIRED', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_SESSION_REQUIRED);
  });
});
