import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvService } from '../../../common/config/env.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { HealthService } from '../health.service.js';

describe('HealthService', () => {
  const envService = {
    nodeEnv: 'test',
  } as EnvService;

  const prisma = {
    $queryRaw: vi.fn(),
  } as unknown as PrismaService;

  const healthService = new HealthService(envService, prisma);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getReadiness DB bağlantısı başarılı → ready', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const result = await healthService.getReadiness();

    expect(result.status).toBe('ready');
    expect(result.database).toBe('up');
  });

  it('getReadiness DB bağlantısı başarısız → ServiceUnavailableException', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connection refused'));

    await expect(healthService.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
