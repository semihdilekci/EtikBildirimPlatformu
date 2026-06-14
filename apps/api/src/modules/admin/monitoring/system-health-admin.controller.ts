import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionCode } from '@ethics/policy';

import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { SystemHealthAdminService } from './system-health-admin.service.js';

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;

@Controller('admin/system-health')
export class SystemHealthAdminController {
  constructor(private readonly systemHealthAdminService: SystemHealthAdminService) {}

  @RequirePolicy(PermissionCode.ADMIN_VIEW_SYNC_STATUS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async getSystemHealth() {
    const data = await this.systemHealthAdminService.getSystemHealth();
    return { data };
  }
}
