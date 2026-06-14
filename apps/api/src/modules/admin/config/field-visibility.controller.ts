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
  approveFieldVisibilityBatchBodySchema,
  updateFieldVisibilityBodySchema,
  type ApproveFieldVisibilityBatchBody,
  type UpdateFieldVisibilityBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { FieldVisibilityAdminService } from './field-visibility.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/field-visibility')
export class FieldVisibilityController {
  constructor(private readonly fieldVisibilityAdminService: FieldVisibilityAdminService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async getMatrix() {
    const data = await this.fieldVisibilityAdminService.getMatrix();
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.FIELD_VISIBILITY_CHANGED, 'field_visibility_change_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch()
  async proposeChanges(
    @Body(createZodValidationPipe(updateFieldVisibilityBodySchema))
    body: UpdateFieldVisibilityBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.fieldVisibilityAdminService.proposeChanges(user, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.FIELD_VISIBILITY_CHANGED, 'field_visibility_batch_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('batches/:batchId/approve')
  @HttpCode(HttpStatus.OK)
  async approveBatch(
    @Param('batchId') batchId: string,
    @Body(createZodValidationPipe(approveFieldVisibilityBatchBodySchema))
    body: ApproveFieldVisibilityBatchBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.fieldVisibilityAdminService.approveBatch(
      user,
      batchId,
      body,
      correlationId,
    );
    return { data };
  }
}
