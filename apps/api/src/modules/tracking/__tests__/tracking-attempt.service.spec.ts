import { ErrorCode } from '@ethics/shared';
import { describe, expect, it, vi } from 'vitest';

import { TrackingAttemptService } from '../tracking-attempt.service.js';

describe('TrackingAttemptService (unit)', () => {
  const envService = {
    ipHashPepper: 'unit-pepper',
    bruteForceMaxAttempts: 3,
    bruteForceLockoutMinutes: 10,
  };

  function createService(existing: Record<string, unknown> | null) {
    const prisma = {
      loginAttempt: {
        findUnique: vi.fn(() => Promise.resolve(existing)),
        upsert: vi.fn((args: { create: Record<string, unknown> }) => Promise.resolve(args.create)),
      },
    };

    return {
      service: new TrackingAttemptService(prisma as never, envService as never),
      prisma,
    };
  }

  it('hashIpAddress pepper ile deterministik hash üretir', () => {
    const { service } = createService(null);
    const hashA = service.hashIpAddress('203.0.113.1');
    const hashB = service.hashIpAddress('203.0.113.1');
    const hashC = service.hashIpAddress('203.0.113.2');

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  it('assertNotLocked aktif kilit varsa AUTH_ACCOUNT_LOCKED', async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    const { service } = createService({
      failedCount: 3,
      lockedUntil,
    });

    await expect(service.assertNotLocked('203.0.113.1', 'ETK-ABCD-EFGH')).rejects.toMatchObject({
      code: ErrorCode.AUTH_ACCOUNT_LOCKED,
    });
  });

  it('assertNotLocked süresi dolmuş kilit geçer', async () => {
    const { service } = createService({
      failedCount: 3,
      lockedUntil: new Date(Date.now() - 60_000),
    });

    await expect(service.assertNotLocked('203.0.113.1', 'ETK-ABCD-EFGH')).resolves.toBeUndefined();
  });

  it('recordFailure eşik aşılınca lockoutTriggered true', async () => {
    const { service, prisma } = createService({ failedCount: 2, lockedUntil: null });

    const result = await service.recordFailure('203.0.113.1', 'ETK-ABCD-EFGH');

    expect(result).toMatchObject({
      failedCount: 3,
      lockoutTriggered: true,
    });
    expect(prisma.loginAttempt.upsert).toHaveBeenCalled();
  });

  it('recordSuccess failedCount sıfırlar', async () => {
    const { service, prisma } = createService({ failedCount: 2, lockedUntil: null });

    await service.recordSuccess('203.0.113.1', 'ETK-ABCD-EFGH');

    expect(prisma.loginAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ failedCount: 0, lockedUntil: null }),
      }),
    );
  });
});
