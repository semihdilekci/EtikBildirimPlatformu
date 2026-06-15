import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import {
  completeTaskBodySchema,
  decideTaskBodySchema,
  delegateTaskBodySchema,
  listTasksQuerySchema,
  type CompleteTaskBody,
  type DecideTaskBody,
  type DelegateTaskBody,
  type ListTasksQuery,
} from '@ethics/dto';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { TaskService } from './task.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const TASK_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const TASK_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('tasks')
export class TaskController {
  constructor(@Inject(TaskService) private readonly taskService: TaskService) {}

  @RequirePolicy(PermissionCode.TASK_LIST)
  @Throttle({ default: TASK_READ_RATE_LIMIT })
  @Get()
  async listTasks(
    @Query(createZodValidationPipe(listTasksQuerySchema as ZodSchema<ListTasksQuery>))
    query: ListTasksQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.listTasks(user, query);
  }

  @RequirePolicy(PermissionCode.TASK_LIST)
  @Throttle({ default: TASK_READ_RATE_LIMIT })
  @Get(':id')
  async getTaskDetail(@Param('id') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.taskService.getTaskDetail(user, taskId);
    return { data };
  }

  @RequirePolicy(PermissionCode.TASK_COMPLETE)
  @AuditAction(AuditEventType.TASK_COMPLETED, 'task_completed', { deferToService: true })
  @Throttle({ default: TASK_MUTATION_RATE_LIMIT })
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeTask(
    @Param('id') taskId: string,
    @Body(createZodValidationPipe(completeTaskBodySchema)) body: CompleteTaskBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.taskService.completeTask(user, taskId, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.TASK_DELEGATE)
  @AuditAction(AuditEventType.TASK_DELEGATED, 'task_delegated', { deferToService: true })
  @Throttle({ default: TASK_MUTATION_RATE_LIMIT })
  @Post(':id/delegate')
  @HttpCode(HttpStatus.OK)
  async delegateTask(
    @Param('id') taskId: string,
    @Body(createZodValidationPipe(delegateTaskBodySchema)) body: DelegateTaskBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.taskService.delegateTask(user, taskId, body, correlationId);
    return { data };
  }

  @RequirePolicy(PermissionCode.ADMIN_MAKER_CHECKER_APPROVE)
  @AuditAction(AuditEventType.ROLE_ASSIGNMENT_APPROVED, 'approval_work_item_decided', {
    deferToService: true,
  })
  @Throttle({ default: TASK_MUTATION_RATE_LIMIT })
  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  async decideApprovalWorkItem(
    @Param('id') workItemId: string,
    @Body(createZodValidationPipe(decideTaskBodySchema)) body: DecideTaskBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.taskService.decideApprovalWorkItem(
      user,
      workItemId,
      body,
      correlationId,
    );
    return { data };
  }
}
