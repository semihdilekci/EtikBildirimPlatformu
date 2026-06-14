import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import {
  approveSystemSettingBatchBodySchema,
  bulkUpdateSystemSettingsBodySchema,
  updateSystemSettingBodySchema,
  type ApproveSystemSettingBatchBody,
  type BulkUpdateSystemSettingsBody,
  type UpdateSystemSettingBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { ConfigService } from './config.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/system-settings')
export class SystemSettingsController {
  constructor(private readonly configService: ConfigService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listSystemSettings() {
    const data = await this.configService.listSystemSettings();
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.SYSTEM_SETTING_CHANGED, 'system_setting_change_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch('bulk')
  async bulkUpdateSystemSettings(
    @Body(createZodValidationPipe(bulkUpdateSystemSettingsBodySchema))
    body: BulkUpdateSystemSettingsBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.configService.proposeBulkSystemSettingChanges(
      user,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.SYSTEM_SETTING_CHANGED, 'system_setting_change_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch(':key')
  async updateSystemSetting(
    @Param('key') key: string,
    @Body(createZodValidationPipe(updateSystemSettingBodySchema)) body: UpdateSystemSettingBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.configService.proposeSystemSettingChange(
      user,
      key,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.SYSTEM_SETTING_CHANGED, 'system_setting_batch_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('batches/:batchId/approve')
  @HttpCode(HttpStatus.OK)
  async approveSystemSettingBatch(
    @Param('batchId') batchId: string,
    @Body(createZodValidationPipe(approveSystemSettingBatchBodySchema))
    body: ApproveSystemSettingBatchBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.configService.approveSystemSettingBatch(
      user,
      batchId,
      body,
      correlationId,
    );
    return { data };
  }
}
