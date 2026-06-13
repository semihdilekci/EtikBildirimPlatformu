import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { AuthService } from '../auth.service.js';
import { SessionAuthGuard } from '../guards/session-auth.guard.js';

describe('SessionAuthGuard', () => {
  const authService = {
    loadAuthenticatedUser: vi.fn(),
  } as unknown as AuthService;

  const guard = new SessionAuthGuard(authService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  it('session yokken AUTH_SESSION_REQUIRED reddeder', async () => {
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
    vi.mocked(authService.loadAuthenticatedUser).mockResolvedValue({
      id: 'user-1',
      email: 'active@example.com',
      displayName: 'Active User',
      roles: [],
      clearanceLevel: 'NORMAL',
      companyId: null,
      companyName: null,
      isGeneralSecretary: false,
    });

    const request: { user?: Record<string, unknown> } = {
      user: { userId: 'user-1' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user?.['email']).toBe('active@example.com');
  });
});
