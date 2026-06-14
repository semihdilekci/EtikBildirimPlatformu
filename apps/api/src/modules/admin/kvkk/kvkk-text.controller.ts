import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import {
  approveKvkkTextBatchBodySchema,
  createKvkkTextBodySchema,
  type ApproveKvkkTextBatchBody,
  type CreateKvkkTextBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { KvkkTextAdminService } from './kvkk-text-admin.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/kvkk-texts')
export class KvkkTextController {
  constructor(private readonly kvkkTextAdminService: KvkkTextAdminService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_KVKK)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listTexts(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.kvkkTextAdminService.listTexts(user);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_KVKK)
  @AuditAction(AuditEventType.KVKK_TEXT_PUBLISHED, 'kvkk_text_publish_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async proposePublish(
    @Body(createZodValidationPipe(createKvkkTextBodySchema)) body: CreateKvkkTextBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.kvkkTextAdminService.proposePublish(user, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.KVKK_TEXT_PUBLISHED, 'kvkk_text_batch_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('batches/:batchId/approve')
  @HttpCode(HttpStatus.OK)
  async approveBatch(
    @Param('batchId') batchId: string,
    @Body(createZodValidationPipe(approveKvkkTextBatchBodySchema))
    body: ApproveKvkkTextBatchBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.kvkkTextAdminService.approveBatch(user, batchId, body, correlationId);
    return { data };
  }
}
