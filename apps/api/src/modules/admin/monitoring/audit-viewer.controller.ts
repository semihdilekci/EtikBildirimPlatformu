import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionCode } from '@ethics/policy';
import {
  listAdminAuditEventsQuerySchema,
  requestAdminAuditExportBodySchema,
  type ListAdminAuditEventsQuery,
  type RequestAdminAuditExportBody,
} from '@ethics/dto';
import type { ZodSchema } from 'zod';

import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { AuditViewerService } from './audit-viewer.service.js';

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 20, ttl: 60_000 } as const;

@Controller('admin/audit-events')
export class AuditViewerController {
  constructor(private readonly auditViewerService: AuditViewerService) {}

  @RequirePolicy(PermissionCode.AUDIT_VIEW_METADATA)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listAuditEvents(
    @Query(
      createZodValidationPipe(
        listAdminAuditEventsQuerySchema as ZodSchema<ListAdminAuditEventsQuery>,
      ),
    )
    query: ListAdminAuditEventsQuery,
  ) {
    const data = await this.auditViewerService.listAuditEvents(query);
    return { data };
  }

  @RequirePolicy(PermissionCode.AUDIT_VIEW_METADATA)
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestAuditExport(
    @Body(createZodValidationPipe(requestAdminAuditExportBodySchema))
    body: RequestAdminAuditExportBody,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.auditViewerService.requestAuditExport(user, body);
    return { data };
  }

  @RequirePolicy(PermissionCode.AUDIT_VIEW_METADATA)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get('export/:jobId')
  async getAuditExportJob(@Param('jobId') jobId: string, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.auditViewerService.getAuditExportJob(user, jobId);
    return { data };
  }

  @RequirePolicy(PermissionCode.AUDIT_VIEW_METADATA)
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post('verify-chain')
  @HttpCode(HttpStatus.OK)
  async verifyChainIntegrity() {
    const data = await this.auditViewerService.verifyChainIntegrity();
    return { data };
  }
}
