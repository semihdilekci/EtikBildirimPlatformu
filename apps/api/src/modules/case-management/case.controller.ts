import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import {
  createCaseBodySchema,
  createTransitionBodySchema,
  listCasesQuerySchema,
  updateCaseConfidentialityBodySchema,
  type CreateCaseBody,
  type CreateTransitionBody,
  type ListCasesQuery,
  type UpdateCaseConfidentialityBody,
} from '@ethics/dto';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { CaseService } from './case.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const CASE_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const CASE_TRANSITION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;
const CASE_CONFIDENTIALITY_RATE_LIMIT = { limit: 20, ttl: 60_000 } as const;
const CASE_CREATE_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('cases')
export class CaseController {
  constructor(@Inject(CaseService) private readonly caseService: CaseService) {}

  @RequirePolicy(PermissionCode.CASE_LIST)
  @Throttle({ default: CASE_READ_RATE_LIMIT })
  @Get()
  async listCases(
    @Query(createZodValidationPipe(listCasesQuerySchema as ZodSchema<ListCasesQuery>))
    query: ListCasesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.caseService.listCases(user, query);
    return result;
  }

  @RequirePolicy(PermissionCode.CASE_READ)
  @Throttle({ default: CASE_READ_RATE_LIMIT })
  @Get(':id/transitions')
  async listCaseTransitions(@Param('id') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.caseService.listCaseTransitions(user, caseId);
    return { data };
  }

  @RequirePolicy(PermissionCode.CASE_READ)
  @AuditAction(AuditEventType.CASE_VIEWED, 'case_viewed', { deferToService: true })
  @Throttle({ default: CASE_READ_RATE_LIMIT })
  @Get(':id')
  async getCaseDetail(
    @Param('id') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.caseService.getCaseDetail(user, caseId, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.CASE_PRE_REVIEW)
  @AuditAction(AuditEventType.CASE_TRANSITION, 'case_opened', { deferToService: true })
  @Throttle({ default: CASE_CREATE_RATE_LIMIT })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCaseFromReport(
    @Body(createZodValidationPipe(createCaseBodySchema)) body: CreateCaseBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.caseService.createCaseFromReport(user, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.CASE_TRANSITION)
  @AuditAction(AuditEventType.CASE_TRANSITION, 'case_transition', { deferToService: true })
  @Throttle({ default: CASE_TRANSITION_RATE_LIMIT })
  @Post(':id/transitions')
  @HttpCode(HttpStatus.OK)
  async createTransition(
    @Param('id') caseId: string,
    @Body(createZodValidationPipe(createTransitionBodySchema)) body: CreateTransitionBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.caseService.executeTransition(user, caseId, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.CASE_UPDATE_CONFIDENTIALITY)
  @AuditAction(AuditEventType.CASE_CONFIDENTIALITY_CHANGED, 'case_confidentiality_changed', {
    deferToService: true,
  })
  @Throttle({ default: CASE_CONFIDENTIALITY_RATE_LIMIT })
  @Patch(':id/confidentiality')
  @HttpCode(HttpStatus.OK)
  async updateConfidentiality(
    @Param('id') caseId: string,
    @Body(createZodValidationPipe(updateCaseConfidentialityBodySchema))
    body: UpdateCaseConfidentialityBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.caseService.updateConfidentiality(user, caseId, body, correlationId);
    return { data };
  }
}
