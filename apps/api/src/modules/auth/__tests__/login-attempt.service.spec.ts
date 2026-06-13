import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { EnvService } from '../../../common/config/env.service.js';
import { LoginAttemptService } from '../login-attempt.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

describe('LoginAttemptService', () => {
  const prisma = {
    loginAttempt: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  } as unknown as PrismaService;

  const envService = {
    ipHashPepper: 'test-pepper-min-16-chars',
    bruteForceMaxAttempts: 3,
    bruteForceLockoutMinutes: 15,
  } as EnvService;

  const service = new LoginAttemptService(prisma, envService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kilitli IP için assertNotLocked hata fırlatır', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValue({
      scopeKey: 'oidc:ip:abc',
      lockedUntil: new Date(Date.now() + 60_000),
    } as never);

    await expect(service.assertNotLocked('127.0.0.1')).rejects.toMatchObject({
      code: ErrorCode.AUTH_BRUTE_FORCE_LOCKED,
    });

    try {
      await service.assertNotLocked('127.0.0.1');
    } catch (error) {
      expect((error as DomainException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('başarısız denemeler eşiğe ulaşınca lockout yazar', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValue({
      scopeKey: 'oidc:ip:abc',
      failedCount: 2,
    } as never);

    await service.recordFailure('127.0.0.1');

    expect(prisma.loginAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          failedCount: 3,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('kayıt var ama lockout yoksa assertNotLocked geçer', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValue({
      scopeKey: 'oidc:ip:abc',
      lockedUntil: null,
      failedCount: 1,
    } as never);

    await expect(service.assertNotLocked('127.0.0.1')).resolves.toBeUndefined();
  });

  it('lockout kaydı yoksa assertNotLocked geçer', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValue(null);

    await expect(service.assertNotLocked('127.0.0.1')).resolves.toBeUndefined();
  });

  it('süresi dolmuş lockout engeli uygulanmaz', async () => {
    vi.mocked(prisma.loginAttempt.findUnique).mockResolvedValue({
      scopeKey: 'oidc:ip:abc',
      lockedUntil: new Date(Date.now() - 60_000),
    } as never);

    await expect(service.assertNotLocked('127.0.0.1')).resolves.toBeUndefined();
  });

  it('başarılı deneme lockout sayaçlarını sıfırlar', async () => {
    await service.recordSuccess('127.0.0.1', 'user-1');

    expect(prisma.loginAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          failedCount: 0,
          lockedUntil: null,
          userId: 'user-1',
        }),
      }),
    );
  });
});
