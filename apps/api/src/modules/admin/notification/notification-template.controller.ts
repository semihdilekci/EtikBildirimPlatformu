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
  approveNotificationTemplateBatchBodySchema,
  previewNotificationTemplateBodySchema,
  sendTestNotificationTemplateBodySchema,
  updateNotificationTemplateBodySchema,
  type ApproveNotificationTemplateBatchBody,
  type PreviewNotificationTemplateBody,
  type SendTestNotificationTemplateBody,
  type UpdateNotificationTemplateBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { Authenticated } from '../../../common/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { NotificationTemplateAdminService } from './notification-template-admin.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/notification-templates')
export class NotificationTemplateController {
  constructor(
    private readonly notificationTemplateAdminService: NotificationTemplateAdminService,
  ) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listTemplates() {
    const data = await this.notificationTemplateAdminService.listTemplates();
    return { data };
  }

  @Authenticated()
  @AuditAction(
    AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
    'notification_template_change_requested',
    {
      deferToService: true,
    },
  )
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch(':templateCode')
  async proposeChange(
    @Param('templateCode') templateCode: string,
    @Body(createZodValidationPipe(updateNotificationTemplateBodySchema))
    body: UpdateNotificationTemplateBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.notificationTemplateAdminService.proposeChange(
      user,
      templateCode,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(
    AuditEventType.NOTIFICATION_TEMPLATE_CHANGED,
    'notification_template_batch_approved',
    {
      deferToService: true,
    },
  )
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('batches/:batchId/approve')
  @HttpCode(HttpStatus.OK)
  async approveBatch(
    @Param('batchId') batchId: string,
    @Body(createZodValidationPipe(approveNotificationTemplateBatchBodySchema))
    body: ApproveNotificationTemplateBatchBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.notificationTemplateAdminService.approveBatch(
      user,
      batchId,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Post('preview/:templateCode')
  @HttpCode(HttpStatus.OK)
  async previewTemplate(
    @Param('templateCode') templateCode: string,
    @Body(createZodValidationPipe(previewNotificationTemplateBodySchema))
    body: PreviewNotificationTemplateBody,
  ) {
    const data = await this.notificationTemplateAdminService.previewTemplate(templateCode, body);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.NOTIFICATION_TEMPLATE_CHANGED, 'notification_template_test_sent', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('send-test/:templateCode')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(
    @Param('templateCode') templateCode: string,
    @Body(createZodValidationPipe(sendTestNotificationTemplateBodySchema))
    body: SendTestNotificationTemplateBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.notificationTemplateAdminService.sendTestEmail(
      user,
      templateCode,
      body,
      correlationId,
    );
    return { data };
  }
}
