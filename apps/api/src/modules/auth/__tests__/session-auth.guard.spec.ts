import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IS_AUTHENTICATED_KEY,
  IS_PUBLIC_KEY,
} from '../../../common/constants/auth-route.metadata.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { AuthService } from '../auth.service.js';
import { SessionAuthGuard } from '../guards/session-auth.guard.js';

describe('SessionAuthGuard', () => {
  const authService = {
    loadAuthenticatedUser: vi.fn(),
  } as unknown as AuthService;

  const reflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as Reflector;

  const guard = new SessionAuthGuard(authService, reflector);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === IS_AUTHENTICATED_KEY) {
        return false;
      }
      return undefined;
    });
  });

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () =>
        function handler() {
          return undefined;
        },
      getClass: () =>
        class TestController {
          readonly marker = true;
        },
    } as unknown as ExecutionContext;
  }

  function mockAuthenticatedRoute(): void {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === IS_AUTHENTICATED_KEY) {
        return true;
      }
      return undefined;
    });
  }

  function mockPublicRoute(): void {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) {
        return true;
      }
      return false;
    });
  }

  it('@Public route session kontrolünden muaf', async () => {
    mockPublicRoute();

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);

    expect(authService.loadAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('metadata yoksa session kontrolü atlanır', async () => {
    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
  });

  it('@Authenticated route session yokken AUTH_SESSION_REQUIRED reddeder', async () => {
    mockAuthenticatedRoute();

    await expect(guard.canActivate(createContext({}))).rejects.toMatchObject({
      code: ErrorCode.AUTH_SESSION_REQUIRED,
    });

    try {
      await guard.canActivate(createContext({}));
    } catch (error) {
      expect((error as DomainException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('pasif veya silinmiş kullanıcı için AUTH_SESSION_EXPIRED reddeder', async () => {
    mockAuthenticatedRoute();
    vi.mocked(authService.loadAuthenticatedUser).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({
          user: { userId: 'missing-user' },
        }),
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_SESSION_EXPIRED,
    });
  });

  it('userId eksik session için AUTH_SESSION_REQUIRED reddeder', async () => {
    mockAuthenticatedRoute();

    await expect(
      guard.canActivate(
        createContext({
          user: {},
        }),
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_SESSION_REQUIRED,
    });
  });

  it('geçerli session kullanıcısını request.user üzerine yükler', async () => {
    mockAuthenticatedRoute();
    vi.mocked(authService.loadAuthenticatedUser).mockResolvedValue({
      id: 'user-1',
      email: 'active@example.com',
      displayName: 'Active User',
      roles: [],
      clearanceLevel: 'NORMAL',
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    });

    const request: { user?: Record<string, unknown> } = {
      user: { userId: 'user-1' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user?.['email']).toBe('active@example.com');
  });
});
