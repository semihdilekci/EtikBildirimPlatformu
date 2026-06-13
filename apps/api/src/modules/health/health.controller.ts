import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { PLATFORM_NAME } from '@ethics/shared';

import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth(PLATFORM_NAME);
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async getReadiness() {
    const readiness = await this.healthService.getReadiness();
    return { data: readiness };
  }
}
