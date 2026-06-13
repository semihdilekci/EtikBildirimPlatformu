import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import passport from 'passport';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvService } from '../../../common/config/env.service.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { LoginAttemptService } from '../login-attempt.service.js';

describe('AuthController', () => {
  const authService = {
    validateReturnUrl: vi.fn(),
    buildMeResponse: vi.fn(),
    buildIdpLogoutUrl: vi.fn(),
    loadAuthenticatedUser: vi.fn(),
  } as unknown as AuthService;

  const loginAttemptService = {
    assertNotLocked: vi.fn(),
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
  } as unknown as LoginAttemptService;

  const envService = {
    webAppUrl: 'http://localhost:5173',
    isProduction: false,
  } as EnvService;

  const controller = new AuthController(authService, loginAttemptService, envService);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loginAttemptService.assertNotLocked).mockResolvedValue(undefined);
    vi.mocked(loginAttemptService.recordSuccess).mockResolvedValue(undefined);
    vi.mocked(loginAttemptService.recordFailure).mockResolvedValue(undefined);
    vi.mocked(authService.validateReturnUrl).mockReturnValue('http://localhost:5173/app/cases');
    vi.mocked(authService.buildIdpLogoutUrl).mockReturnValue('https://accounts.google.com/Logout');
  });

  it('oidcCallback başarıda returnUrl query param ile frontend callback sayfasına yönlendirir', async () => {
    const redirect = vi.fn();
    const request = {
      headers: {},
      ip: '127.0.0.1',
      session: {
        returnUrl: 'http://localhost:5173/app/cases',
        cookie: { maxAge: 60_000 },
      },
      logIn: (_user: unknown, callback: (error?: Error) => void) => {
        callback();
      },
      logout: (callback: (error?: Error) => void) => {
        callback();
      },
    };

    vi.spyOn(passport, 'authenticate').mockImplementationOnce((_strategy, callback) => {
      return ((_req: unknown, _res: unknown) => {
        if (typeof callback === 'function') {
          (callback as (error: Error | null, user: { userId: string }) => void)(null, {
            userId: 'user-controller-1',
          });
        }
      }) as never;
    });

    await controller.oidcCallback(request as never, { redirect } as never);

    expect(redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/callback?returnUrl=http%3A%2F%2Flocalhost%3A5173%2Fapp%2Fcases',
    );
    expect(loginAttemptService.recordSuccess).toHaveBeenCalledWith(
      '127.0.0.1',
      'user-controller-1',
    );
  });

  it('oidcCallback OIDC hatasında AUTH_OIDC_FAILED fırlatır', async () => {
    vi.spyOn(passport, 'authenticate').mockImplementationOnce((_strategy, callback) => {
      return ((_req: unknown, _res: unknown) => {
        if (typeof callback === 'function') {
          (callback as (error: Error | null, user: false) => void)(null, false);
        }
      }) as never;
    });

    await expect(
      controller.oidcCallback(
        {
          headers: {},
          ip: '127.0.0.1',
          session: { cookie: { maxAge: 60_000 } },
        } as never,
        { redirect: vi.fn() } as never,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_OIDC_FAILED,
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(loginAttemptService.recordFailure).toHaveBeenCalledWith('127.0.0.1');
  });

  it('oidcLogin passport hatasını yukarı iletir', async () => {
    vi.spyOn(passport, 'authenticate').mockImplementationOnce(() => {
      return ((_req: unknown, _res: unknown, next?: (error?: Error) => void) => {
        next?.(new Error('passport failed'));
      }) as never;
    });

    await expect(
      controller.oidcLogin(
        {
          headers: {},
          ip: '127.0.0.1',
          session: {},
        } as never,
        { redirect: vi.fn() } as never,
      ),
    ).rejects.toThrow('passport failed');
  });

  it('oidcCallback logIn hatasını yukarı iletir', async () => {
    vi.spyOn(passport, 'authenticate').mockImplementationOnce((_strategy, callback) => {
      return ((_req: unknown, _res: unknown) => {
        if (typeof callback === 'function') {
          (callback as (error: Error | null, user: { userId: string }) => void)(null, {
            userId: 'user-controller-2',
          });
        }
      }) as never;
    });

    await expect(
      controller.oidcCallback(
        {
          headers: {},
          ip: '127.0.0.1',
          session: { cookie: { maxAge: 60_000 } },
          logIn: (_user: unknown, callback: (error?: Error) => void) => {
            callback(new Error('logIn failed'));
          },
        } as never,
        { redirect: vi.fn() } as never,
      ),
    ).rejects.toThrow('logIn failed');
  });

  it('logout request.logout hatasını yukarı iletir', async () => {
    await expect(
      controller.logout(
        {
          logout: (callback: (error?: Error) => void) => {
            callback(new Error('logout failed'));
          },
          session: {
            destroy: (callback: (error?: Error | null) => void) => {
              callback(null);
            },
          },
        } as never,
        { clearCookie: vi.fn() } as never,
      ),
    ).rejects.toThrow('logout failed');
  });

  it('logout session.destroy hatasını yukarı iletir', async () => {
    await expect(
      controller.logout(
        {
          logout: (callback: (error?: Error) => void) => {
            callback();
          },
          session: {
            destroy: (callback: (error?: Error | null) => void) => {
              callback(new Error('destroy failed'));
            },
          },
        } as never,
        { clearCookie: vi.fn() } as never,
      ),
    ).rejects.toThrow('destroy failed');
  });

  it('logout session destroy sonrası loggedOut yanıtı döner', async () => {
    const clearCookie = vi.fn();
    const request = {
      logout: (callback: (error?: Error) => void) => {
        callback();
      },
      session: {
        destroy: (callback: (error?: Error | null) => void) => {
          callback(null);
        },
      },
    };

    const result = await controller.logout(request as never, { clearCookie } as never);

    expect(result.data.loggedOut).toBe(true);
    expect(result.data.idpLogoutUrl).toBe('https://accounts.google.com/Logout');
    expect(clearCookie).toHaveBeenCalledWith(
      'sid',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
      }),
    );
  });
});
