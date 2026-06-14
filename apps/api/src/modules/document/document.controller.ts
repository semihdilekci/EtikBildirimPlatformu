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
import { PermissionCode } from '@ethics/policy';
import { initiateCaseDocumentBodySchema, type InitiateCaseDocumentBody } from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DocumentService } from './document.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const DOCUMENT_UPLOAD_RATE_LIMIT = { limit: 10, ttl: 300_000 } as const;
const DOCUMENT_DOWNLOAD_RATE_LIMIT = { limit: 50, ttl: 60_000 } as const;

@Controller('documents')
export class DocumentDownloadController {
  constructor(@Inject(DocumentService) private readonly documentService: DocumentService) {}

  @RequirePolicy(PermissionCode.DOCUMENT_DOWNLOAD)
  @AuditAction(AuditEventType.DOCUMENT_DOWNLOADED, 'document_downloaded', { deferToService: true })
  @Throttle({ default: DOCUMENT_DOWNLOAD_RATE_LIMIT })
  @Get(':id/download')
  @HttpCode(HttpStatus.OK)
  async downloadDocument(
    @Param('id') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.documentService.getDocumentDownloadUrl(user, documentId, correlationId);
    return { data };
  }
}

@Controller('cases')
export class DocumentCaseController {
  constructor(@Inject(DocumentService) private readonly documentService: DocumentService) {}

  @RequirePolicy(PermissionCode.CASE_READ)
  @Get(':caseId/documents')
  @HttpCode(HttpStatus.OK)
  async listCaseDocuments(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.documentService.listCaseDocuments(user, caseId);
    return { data };
  }

  @RequirePolicy(PermissionCode.DOCUMENT_UPLOAD)
  @AuditAction(AuditEventType.DOCUMENT_UPLOADED, 'document_uploaded', { deferToService: true })
  @Throttle({ default: DOCUMENT_UPLOAD_RATE_LIMIT })
  @Post(':caseId/documents')
  @HttpCode(HttpStatus.CREATED)
  async initiateCaseDocumentUpload(
    @Param('caseId') caseId: string,
    @Body(createZodValidationPipe(initiateCaseDocumentBodySchema)) body: InitiateCaseDocumentBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.documentService.initiateCaseDocumentUpload(
      user,
      caseId,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.DOCUMENT_UPLOAD)
  @AuditAction(AuditEventType.DOCUMENT_UPLOADED, 'document_content_sealed', {
    deferToService: true,
  })
  @Throttle({ default: DOCUMENT_UPLOAD_RATE_LIMIT })
  @Post(':caseId/documents/:documentId/complete-upload')
  @HttpCode(HttpStatus.OK)
  async completeCaseDocumentUpload(
    @Param('caseId') caseId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.documentService.completeCaseDocumentUpload(
      user,
      caseId,
      documentId,
      correlationId,
    );
    return { data };
  }
}
