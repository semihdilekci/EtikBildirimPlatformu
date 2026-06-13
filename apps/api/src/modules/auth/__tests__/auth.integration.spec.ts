import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@ethics/shared';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PolicyGuardService } from '../../../authorization/policy-guard.service.js';
import { PolicyGuard } from '../../../common/guards/policy.guard.js';
import { EnvService } from '../../../common/config/env.service.js';
import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { SessionAuthGuard } from '../guards/session-auth.guard.js';
import { LoginAttemptService } from '../login-attempt.service.js';
import { AuthSessionSerializer } from '../session/auth-session.serializer.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('Auth integration (OIDC mock flow)', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    authService = {
      validateReturnUrl: vi.fn().mockReturnValue('http://localhost:5173/app/dashboard'),
      provisionUserFromOidc: vi.fn(),
      loadAuthenticatedUser: vi.fn(),
      buildMeResponse: vi.fn().mockReturnValue({
        id: 'user-integration-1',
        email: 'integration@example.com',
        displayName: 'Integration User',
        roles: [],
        clearanceLevel: 'NORMAL',
        companyId: null,
        companyName: null,
        isGeneralSecretary: false,
        sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      buildIdpLogoutUrl: vi.fn().mockReturnValue('https://accounts.google.com/Logout'),
    } as unknown as AuthService;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: LoginAttemptService,
          useValue: {
            assertNotLocked: vi.fn().mockResolvedValue(undefined),
            recordFailure: vi.fn().mockResolvedValue(undefined),
            recordSuccess: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EnvService,
          useValue: {
            webAppUrl: 'http://localhost:5173',
            isProduction: false,
          },
        },
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
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));

    app.use(
      session({
        secret: 'test-session-secret-minimum-32-characters-long',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      }),
    );
    app.use(passport.initialize());
    app.use(passport.session());

    const serializer = moduleRef.get(AuthSessionSerializer);
    passport.serializeUser((user, done) => serializer.serializeUser(user as never, done));
    passport.deserializeUser((payload, done) => serializer.deserializeUser(payload as never, done));

    await app.init();

    vi.spyOn(passport, 'authenticate').mockImplementation((_strategy, callback) => {
      return ((req: unknown, res: unknown, next?: (error?: unknown) => void) => {
        if (typeof callback === 'function') {
          (callback as (err: null, user: { userId: string }) => void)(null, {
            userId: 'user-integration-1',
          });
          return undefined;
        }

        next?.();
        return undefined;
      }) as never;
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  }, 30_000);

  it('OIDC callback → session cookie → /auth/me → logout akışı token sızdırmaz', async () => {
    vi.mocked(authService.loadAuthenticatedUser).mockResolvedValue({
      id: 'user-integration-1',
      email: 'integration@example.com',
      displayName: 'Integration User',
      roles: [],
      clearanceLevel: 'NORMAL',
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    });

    const agent = request.agent(app.getHttpServer());

    await agent.get('/api/v1/auth/oidc/callback?code=mock&state=mock').expect(HttpStatus.FOUND);

    const meResponse = await agent.get('/api/v1/auth/me').expect(HttpStatus.OK);

    expect(meResponse.body.data.email).toBe('integration@example.com');
    expect(meResponse.body.data.roles).toEqual([]);
    expect(meResponse.body.accessToken).toBeUndefined();
    expect(meResponse.body.token).toBeUndefined();

    const logoutResponse = await agent.post('/api/v1/auth/logout').expect(HttpStatus.OK);
    expect(logoutResponse.body.data.loggedOut).toBe(true);
  });

  it('session olmadan /auth/me → 401 AUTH_SESSION_REQUIRED', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_SESSION_REQUIRED);
  });

  it('kilitli IP oidc/login denemesinde lockout reddeder', async () => {
    const loginAttemptService = app.get(LoginAttemptService);
    vi.mocked(loginAttemptService.assertNotLocked).mockRejectedValueOnce(
      new DomainException(
        ErrorCode.AUTH_BRUTE_FORCE_LOCKED,
        'Çok fazla başarısız giriş denemesi.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    const response = await request(app.getHttpServer()).get('/api/v1/auth/oidc/login');

    expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_BRUTE_FORCE_LOCKED);
  });

  it('OIDC callback başarısız olduğunda AUTH_OIDC_FAILED döner', async () => {
    vi.spyOn(passport, 'authenticate').mockImplementationOnce((_strategy, callback) => {
      return ((_req: unknown, _res: unknown) => {
        if (typeof callback === 'function') {
          (callback as (error: Error | null, user: false) => void)(null, false);
        }
      }) as never;
    });

    const response = await request(app.getHttpServer()).get('/api/v1/auth/oidc/callback');

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(response.body.error.code).toBe(ErrorCode.AUTH_OIDC_FAILED);
  });
});
