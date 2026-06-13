import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import {
  createReportBodySchema,
  initiateAttachmentBodySchema,
  type CreateReportBody,
  type InitiateAttachmentBody,
} from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { IntakeService } from './intake.service.js';
import { ReportAttachmentService } from './report-attachment.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const INTAKE_ATTACHMENT_RATE_LIMIT = { limit: 10, ttl: 300_000 } as const;

/** Public intake yüzeyi — session/policy guard muaf */
@Public()
@Controller('intake')
export class IntakeController {
  constructor(
    @Inject(IntakeService) private readonly intakeService: IntakeService,
    @Inject(ReportAttachmentService)
    private readonly reportAttachmentService: ReportAttachmentService,
  ) {}

  @Get('categories')
  listCategories() {
    return { data: this.intakeService.listCategories() };
  }

  @Get('kvkk-text')
  async getKvkkText() {
    return { data: await this.intakeService.getKvkkText() };
  }

  @Get('companies')
  async listCompanies() {
    return { data: await this.intakeService.listActiveCompanies() };
  }

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @AuditAction(AuditEventType.REPORT_SUBMITTED, 'report_submitted', { deferToService: true })
  async createReport(
    @Body(createZodValidationPipe(createReportBodySchema)) body: CreateReportBody,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.intakeService.createReport(body, correlationId);
    return { data };
  }

  @Post('reports/:trackingCode/attachments')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: INTAKE_ATTACHMENT_RATE_LIMIT })
  @AuditAction(AuditEventType.REPORT_ATTACHMENT_UPLOADED, 'report_attachment_uploaded', {
    deferToService: true,
  })
  async initiateAttachment(
    @Param('trackingCode') trackingCode: string,
    @Body(createZodValidationPipe(initiateAttachmentBodySchema)) body: InitiateAttachmentBody,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.reportAttachmentService.initiateUpload({
      trackingCode,
      body,
      correlationId,
      auditEventType: AuditEventType.REPORT_ATTACHMENT_UPLOADED,
      auditAction: 'report_attachment_uploaded',
    });
    return { data };
  }
}
