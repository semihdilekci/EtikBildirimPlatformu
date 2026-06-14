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
  approveSlaPolicyBatchBodySchema,
  updateSlaPolicyBodySchema,
  type ApproveSlaPolicyBatchBody,
  type UpdateSlaPolicyBody,
} from '@ethics/dto';
import type { TaskTypeCode } from '@ethics/shared';
import type { Request } from 'express';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { SlaPolicyAdminService } from './sla-policy-admin.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/sla-policies')
export class SlaPoliciesController {
  constructor(private readonly slaPolicyAdminService: SlaPolicyAdminService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listPolicies() {
    const data = await this.slaPolicyAdminService.listPolicies();
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.SLA_POLICY_CHANGED, 'sla_policy_change_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch(':taskType')
  async proposeChange(
    @Param('taskType') taskType: string,
    @Body(createZodValidationPipe(updateSlaPolicyBodySchema)) body: UpdateSlaPolicyBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.slaPolicyAdminService.proposeChange(
      user,
      taskType as TaskTypeCode,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.SLA_POLICY_CHANGED, 'sla_policy_batch_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('batches/:batchId/approve')
  @HttpCode(HttpStatus.OK)
  async approveBatch(
    @Param('batchId') batchId: string,
    @Body(createZodValidationPipe(approveSlaPolicyBatchBodySchema))
    body: ApproveSlaPolicyBatchBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.slaPolicyAdminService.approveBatch(user, batchId, body, correlationId);
    return { data };
  }
}
