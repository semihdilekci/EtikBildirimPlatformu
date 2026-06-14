import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import {
  createBusinessCalendarEntryBodySchema,
  deleteBusinessCalendarEntryBodySchema,
  listBusinessCalendarQuerySchema,
  type CreateBusinessCalendarEntryBody,
  type DeleteBusinessCalendarEntryBody,
  type ListBusinessCalendarQuery,
} from '@ethics/dto';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { BusinessCalendarAdminService } from './business-calendar-admin.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/business-calendar')
export class BusinessCalendarController {
  constructor(private readonly businessCalendarAdminService: BusinessCalendarAdminService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listEntries(
    @Query(
      createZodValidationPipe(
        listBusinessCalendarQuerySchema as unknown as ZodSchema<ListBusinessCalendarQuery>,
      ),
    )
    query: ListBusinessCalendarQuery,
  ) {
    const data = await this.businessCalendarAdminService.listEntries(query);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.BUSINESS_CALENDAR_UPDATED, 'business_calendar_entry_created', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEntry(
    @Body(createZodValidationPipe(createBusinessCalendarEntryBodySchema))
    body: CreateBusinessCalendarEntryBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.businessCalendarAdminService.createEntry(user, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_SETTINGS)
  @AuditAction(AuditEventType.BUSINESS_CALENDAR_UPDATED, 'business_calendar_entry_deleted', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Delete(':entryId')
  async deleteEntry(
    @Param('entryId') entryId: string,
    @Body(createZodValidationPipe(deleteBusinessCalendarEntryBodySchema))
    body: DeleteBusinessCalendarEntryBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.businessCalendarAdminService.deleteEntry(
      user,
      entryId,
      body,
      correlationId,
    );
    return { data };
  }
}
