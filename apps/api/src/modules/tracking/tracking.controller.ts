import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType, ErrorCode } from '@ethics/shared';
import {
  initiateAttachmentBodySchema,
  sendSecureMessageBodySchema,
  type InitiateAttachmentBody,
  type SendSecureMessageBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequiresTracking } from '../../common/decorators/requires-tracking.decorator.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ReportAttachmentService } from '../intake/report-attachment.service.js';
import { SecureMessageService } from './secure-message.service.js';
import {
  TRACKING_ATTACHMENT_RATE_LIMIT,
  TRACKING_MESSAGES_READ_RATE_LIMIT,
  TRACKING_MESSAGES_SEND_RATE_LIMIT,
  TRACKING_STATUS_RATE_LIMIT,
  TRACKING_VERIFY_RATE_LIMIT,
} from './tracking.constants.js';
import { TrackingService } from './tracking.service.js';
import type { TrackingReportContext } from './tracking.types.js';

type CorrelatedRequest = Request & { correlationId?: string };

/** Anonim takip yüzeyi — session/policy guard muaf, header auth zorunlu */
@Public()
@Controller('tracking')
export class TrackingController {
  constructor(
    @Inject(TrackingService) private readonly trackingService: TrackingService,
    @Inject(SecureMessageService) private readonly secureMessageService: SecureMessageService,
    @Inject(ReportAttachmentService)
    private readonly reportAttachmentService: ReportAttachmentService,
  ) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: TRACKING_VERIFY_RATE_LIMIT })
  @AuditAction(AuditEventType.TRACKING_VERIFY_ATTEMPT, 'tracking_verify', { deferToService: true })
  async verify(@Req() request: CorrelatedRequest) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.trackingService.verify(request, correlationId);
    return { data };
  }

  @Get('status')
  @RequiresTracking()
  @Throttle({ default: TRACKING_STATUS_RATE_LIMIT })
  getStatus(@Req() request: Request) {
    return { data: this.trackingService.getStatus(request) };
  }

  @Get('messages')
  @RequiresTracking()
  @Throttle({ default: TRACKING_MESSAGES_READ_RATE_LIMIT })
  @AuditAction(AuditEventType.SECURE_MESSAGE_READ, 'secure_message_read', { deferToService: true })
  async listMessages(@Req() request: CorrelatedRequest) {
    const reportContext = request.trackingReport;
    if (!reportContext) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'Takip bağlamı bulunamadı.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.secureMessageService.listMessages(
      reportContext as TrackingReportContext,
      correlationId,
    );
    return { data };
  }

  @Post('messages')
  @RequiresTracking()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: TRACKING_MESSAGES_SEND_RATE_LIMIT })
  @AuditAction(AuditEventType.SECURE_MESSAGE_SENT, 'secure_message_sent', { deferToService: true })
  async sendMessage(
    @Body(createZodValidationPipe(sendSecureMessageBodySchema)) body: SendSecureMessageBody,
    @Req() request: CorrelatedRequest,
  ) {
    const reportContext = request.trackingReport;
    if (!reportContext) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'Takip bağlamı bulunamadı.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.secureMessageService.sendMessage(
      reportContext as TrackingReportContext,
      body,
      correlationId,
    );
    return { data };
  }

  @Post('attachments')
  @RequiresTracking()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: TRACKING_ATTACHMENT_RATE_LIMIT })
  @AuditAction(AuditEventType.TRACKING_ATTACHMENT_UPLOADED, 'tracking_attachment_uploaded', {
    deferToService: true,
  })
  async initiateAttachment(
    @Body(createZodValidationPipe(initiateAttachmentBodySchema)) body: InitiateAttachmentBody,
    @Req() request: CorrelatedRequest,
  ) {
    const trackingCode = request.trackingReport?.trackingCode;
    if (!trackingCode) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'Takip bağlamı bulunamadı.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.reportAttachmentService.initiateUpload({
      trackingCode,
      body,
      correlationId,
      auditEventType: AuditEventType.TRACKING_ATTACHMENT_UPLOADED,
      auditAction: 'tracking_attachment_uploaded',
    });
    return { data };
  }
}
