import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { EnvService } from '../../common/config/env.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface HealthResponse {
  status: 'ok';
  service: string;
  environment: string;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  database: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(EnvService) private readonly envService: EnvService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  getHealth(serviceName: string): HealthResponse {
    return {
      status: 'ok',
      service: serviceName,
      environment: this.envService.nodeEnv,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Veritabanı bağlantısı kurulamadı.',
      });
    }
  }
}
