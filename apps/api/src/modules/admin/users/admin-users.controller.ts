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
import {
  approveAdminUserClearanceBodySchema,
  approveAdminUserRoleBodySchema,
  assignAdminUserRoleBodySchema,
  listAdminUsersQuerySchema,
  revokeAdminUserRoleBodySchema,
  updateAdminUserClearanceBodySchema,
  type ApproveAdminUserClearanceBody,
  type ApproveAdminUserRoleBody,
  type AssignAdminUserRoleBody,
  type ListAdminUsersQuery,
  type RevokeAdminUserRoleBody,
  type UpdateAdminUserClearanceBody,
} from '@ethics/dto';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { AuditAction } from '../../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { AdminUsersService } from './admin-users.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const ADMIN_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const ADMIN_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('admin/users')
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly adminUsersService: AdminUsersService) {}

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get()
  async listUsers(
    @Query(createZodValidationPipe(listAdminUsersQuerySchema as ZodSchema<ListAdminUsersQuery>))
    query: ListAdminUsersQuery,
  ) {
    return this.adminUsersService.listUsers(query);
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @Throttle({ default: ADMIN_READ_RATE_LIMIT })
  @Get(':id')
  async getUserDetail(@Param('id') userId: string) {
    const data = await this.adminUsersService.getUserDetail(userId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @AuditAction(AuditEventType.ROLE_ASSIGNMENT_REQUESTED, 'role_assignment_requested', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post(':id/roles')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('id') userId: string,
    @Body(createZodValidationPipe(assignAdminUserRoleBodySchema)) body: AssignAdminUserRoleBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminUsersService.assignRole(user, userId, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.ROLE_ASSIGNMENT_APPROVED, 'role_assignment_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post(':id/roles/:roleId/approve')
  @HttpCode(HttpStatus.OK)
  async approveRoleAssignment(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @Body(createZodValidationPipe(approveAdminUserRoleBodySchema)) body: ApproveAdminUserRoleBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminUsersService.approveRoleAssignment(
      user,
      userId,
      roleId,
      body,
      correlationId,
    );
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @AuditAction(AuditEventType.ROLE_REVOKED, 'role_revoked', { deferToService: true })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Delete(':id/roles/:roleId')
  async revokeRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @Body(createZodValidationPipe(revokeAdminUserRoleBodySchema)) body: RevokeAdminUserRoleBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminUsersService.revokeRole(user, userId, roleId, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MANAGE_ROLES)
  @AuditAction(AuditEventType.CLEARANCE_UPDATED, 'clearance_updated', { deferToService: true })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Patch(':id/clearance')
  async updateClearance(
    @Param('id') userId: string,
    @Body(createZodValidationPipe(updateAdminUserClearanceBodySchema))
    body: UpdateAdminUserClearanceBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminUsersService.updateClearance(user, userId, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.CLEARANCE_UPDATED, 'clearance_change_approved', {
    deferToService: true,
  })
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @Post(':id/clearance/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  async approveClearanceChange(
    @Param('id') userId: string,
    @Param('requestId') requestId: string,
    @Body(createZodValidationPipe(approveAdminUserClearanceBodySchema))
    body: ApproveAdminUserClearanceBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.adminUsersService.approveClearanceChange(
      user,
      userId,
      requestId,
      body,
      correlationId,
    );
    return { data };
  }
}
