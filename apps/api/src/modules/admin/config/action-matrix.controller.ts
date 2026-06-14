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
import { AuditEventType, type AdminActionCodeValue } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import {
  approveActionMatrixBatchBodySchema,
  updateActionMatrixBodySchema,
  type ApproveActionMatrixBatchBody,
  type UpdateActionMatrixBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { ActionMatrixAdminService } from './action-matrix.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/action-matrix')
export class ActionMatrixController {
  constructor(private readonly actionMatrixAdminService: ActionMatrixAdminService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listMatrix() {
    const data = await this.actionMatrixAdminService.listMatrix();
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.ACTION_MATRIX_CHANGED, 'action_matrix_change_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch(':actionId')
  async proposeChange(
    @Param('actionId') actionId: AdminActionCodeValue,
    @Body(createZodValidationPipe(updateActionMatrixBodySchema)) body: UpdateActionMatrixBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.actionMatrixAdminService.proposeChange(
      user,
      actionId,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.ACTION_MATRIX_CHANGED, 'action_matrix_batch_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('batches/:batchId/approve')
  @HttpCode(HttpStatus.OK)
  async approveBatch(
    @Param('batchId') batchId: string,
    @Body(createZodValidationPipe(approveActionMatrixBatchBodySchema))
    body: ApproveActionMatrixBatchBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.actionMatrixAdminService.approveBatch(
      user,
      batchId,
      body,
      correlationId,
    );
    return { data };
  }
}
