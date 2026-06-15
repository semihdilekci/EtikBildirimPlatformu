import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionCode } from '@ethics/policy';
import { listPendingReportsQuerySchema, type ListPendingReportsQuery } from '@ethics/dto';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { InternalReportService } from './internal-report.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const INTERNAL_REPORT_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;

@Controller('reports')
export class InternalReportController {
  constructor(
    @Inject(InternalReportService) private readonly internalReportService: InternalReportService,
  ) {}

  @RequirePolicy(PermissionCode.CASE_PRE_REVIEW)
  @Throttle({ default: INTERNAL_REPORT_READ_RATE_LIMIT })
  @Get('pending')
  async listPendingReports(
    @Query(
      createZodValidationPipe(listPendingReportsQuerySchema as ZodSchema<ListPendingReportsQuery>),
    )
    query: ListPendingReportsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.internalReportService.listPendingReports(user, query);
  }

  @RequirePolicy(PermissionCode.CASE_PRE_REVIEW)
  @Throttle({ default: INTERNAL_REPORT_READ_RATE_LIMIT })
  @Get(':id')
  async getInternalReportDetail(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() _request: CorrelatedRequest,
  ) {
    const data = await this.internalReportService.getInternalReportDetail(user, reportId);
    return { data };
  }
}
