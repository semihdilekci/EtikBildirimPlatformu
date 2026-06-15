import {
  Body,
  Controller,
  Delete,
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
import { listAdminMasterDataQuerySchema, type ListAdminMasterDataQuery } from '@ethics/dto';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { AdminMasterDataService } from './admin-master-data.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/master-data')
export class AdminMasterDataController {
  constructor(
    @Inject(AdminMasterDataService) private readonly adminMasterDataService: AdminMasterDataService,
  ) {}

  @RequirePolicy(PermissionCode.ADMIN_VIEW_SYNC_STATUS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get('sync-runs')
  async listSyncRuns() {
    return this.adminMasterDataService.listSyncRuns();
  }

  @RequirePolicy(PermissionCode.ADMIN_VIEW_SYNC_STATUS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get(':type')
  async list(
    @Param('type') type: string,
    @Query(
      createZodValidationPipe(
        listAdminMasterDataQuerySchema as unknown as ZodSchema<ListAdminMasterDataQuery>,
      ),
    )
    query: ListAdminMasterDataQuery,
  ) {
    return this.adminMasterDataService.list(type, query);
  }

  @RequirePolicy(PermissionCode.ADMIN_VIEW_SYNC_STATUS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get(':type/:id')
  async getById(@Param('type') type: string, @Param('id') id: string) {
    const data = await this.adminMasterDataService.getById(type, id);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_MASTER_DATA)
  @AuditAction(AuditEventType.MASTER_DATA_CREATED, 'master_data_created', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post(':type')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('type') type: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminMasterDataService.create(user, type, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_MASTER_DATA)
  @AuditAction(AuditEventType.MASTER_DATA_UPDATED, 'master_data_updated', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch(':type/:id')
  async update(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminMasterDataService.update(user, type, id, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_MASTER_DATA)
  @AuditAction(AuditEventType.MASTER_DATA_DELETED, 'master_data_deleted', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Delete(':type/:id')
  async softDelete(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminMasterDataService.softDelete(user, type, id, correlationId);
    return { data };
  }
}
