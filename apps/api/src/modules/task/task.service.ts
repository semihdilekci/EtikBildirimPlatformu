import { HttpStatus, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { CompleteTaskBody, DelegateTaskBody, ListTasksQuery, TaskDetail } from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  Role,
  resolveTaskCompletionCommand,
  TaskEventType,
  TaskStatus,
  TaskType,
  TASK_STATUS_VALUES,
  TASK_TYPES_WITHOUT_COMPLETION,
  type AuditActorTypeCode,
  type CaseStateCode,
  type TaskStatusCode,
  type TaskTypeCode,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { NotificationService } from '../../notification/notification.service.js';
import { PolicyScopeService } from '../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { lazyProviderToken } from '../../common/utils/lazy-provider-token.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CreatedTransitionRecord,
  TransitionTaskStub,
} from '../case-management/transition/transition.types.js';
import type { TransitionService } from '../case-management/transition/transition.service.js';
import {
  buildTaskCursorSortCondition,
  decodeTaskListCursor,
  encodeTaskListCursor,
  resolveTaskSortField,
  toTaskSortValue,
} from './task-pagination.util.js';
import { toTaskDetail, toTaskListItem, type TaskWithCase } from './task.mapper.js';
import { resolveTasksForTransition } from './task-transition-catalog.js';
import { recordTaskEvent } from './task-event.writer.js';
import { SlaCalculatorService } from './sla/sla-calculator.service.js';

const TASK_DETAIL_INCLUDE = {
  case: {
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const satisfies Prisma.TaskInclude;

@Injectable()
export class TaskService {
  private transitionServiceRef: TransitionService | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyScope: PolicyScopeService,
    private readonly auditPublisher: AuditEventPublisher,
    private readonly slaCalculator: SlaCalculatorService,
    private readonly notificationService: NotificationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Test factory circular wiring — production ModuleRef lazy resolve kullanır. */
  wireTransitionServiceForTests(transitionService: TransitionService): void {
    this.transitionServiceRef = transitionService;
  }

  private get transitionService(): TransitionService {
    if (this.transitionServiceRef) {
      return this.transitionServiceRef;
    }

    return this.moduleRef.get(
      lazyProviderToken<TransitionService>(
        '../case-management/transition/transition.service.js',
        'TransitionService',
      ),
      { strict: false },
    );
  }

  async createTasksForTransition(
    tx: Prisma.TransactionClient,
    caseEntity: {
      id: string;
      companyId: string;
      assignedRapporteurId: string | null;
      assignedActionOwnerId: string | null;
    },
    transition: CreatedTransitionRecord,
    actor: { type: AuditActorTypeCode; userId?: string | null },
  ): Promise<TransitionTaskStub[]> {
    const definitions = resolveTasksForTransition(
      caseEntity as Parameters<typeof resolveTasksForTransition>[0],
      transition,
    );
    const created: TransitionTaskStub[] = [];

    for (const definition of definitions) {
      const assignees =
        definition.taskType === TaskType.MEMBER_APPROVAL_TASK
          ? await this.listActiveCouncilMemberIds(tx)
          : [definition.assignedUserId ?? null];

      for (const assigneeUserId of assignees) {
        const assignedAt = new Date();
        const { dueAt, slaPolicyId } = await this.slaCalculator.calculateDueAt(
          tx,
          definition.taskType,
          assignedAt,
        );

        const task = await tx.task.create({
          data: {
            caseId: caseEntity.id,
            taskType: definition.taskType,
            status: TaskStatus.PENDING,
            assignedRole: definition.assignedRole,
            assignedUserId: assigneeUserId,
            assignedCompanyId: definition.assignedCompanyId ?? null,
            assignedFunctionId: definition.assignedFunctionId ?? null,
            createdByTransitionId: transition.id,
            dueAt,
            slaPolicyId,
          },
        });

        await recordTaskEvent(tx, {
          taskId: task.id,
          eventType: TaskEventType.CREATED,
          actorType: actor.type,
          actorUserId: actor.userId,
          metadata: {
            transitionId: transition.id,
            taskType: definition.taskType,
            assignedUserId: assigneeUserId,
          },
        });

        created.push({
          id: task.id,
          taskType: task.taskType,
          assignedRole: task.assignedRole,
          assignedUserId: task.assignedUserId,
        });
      }
    }

    return created;
  }

  async listTasks(
    user: AuthenticatedUser,
    query: ListTasksQuery,
  ): Promise<{
    data: ReturnType<typeof toTaskListItem>[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    const policyScope = this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput;
    const filterScope = this.buildListFilterScope(query);
    const sortField = resolveTaskSortField(query.sortBy);
    const take = query.limit + 1;

    const whereConditions: Prisma.TaskWhereInput[] = [policyScope, filterScope];

    if (query.cursor) {
      try {
        const cursorPayload = decodeTaskListCursor(query.cursor);
        whereConditions.push(
          buildTaskCursorSortCondition(sortField, query.sortOrder, cursorPayload),
        );
      } catch {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Geçersiz sayfalama imleci.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = (await this.prisma.task.findMany({
      where: { AND: whereConditions },
      orderBy: [{ [sortField]: query.sortOrder }, { id: query.sortOrder }],
      take,
      include: TASK_DETAIL_INCLUDE,
    })) as TaskWithCase[];

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const lastRow = pageRows.at(-1);

    return {
      data: pageRows.map(toTaskListItem),
      pagination: {
        nextCursor:
          hasMore && lastRow
            ? encodeTaskListCursor({
                id: lastRow.id,
                sortValue: this.resolveRowSortValue(lastRow, sortField),
              })
            : null,
        hasMore,
        total: null,
      },
    };
  }

  async getTaskDetail(user: AuthenticatedUser, taskId: string): Promise<TaskDetail> {
    const task = await this.findTaskWithinScope(user, taskId);
    return toTaskDetail(task);
  }

  async completeTask(
    user: AuthenticatedUser,
    taskId: string,
    body: CompleteTaskBody,
    correlationId: string,
  ): Promise<TaskDetail> {
    const transitionIdempotencyKey = `task-complete:${body.idempotencyKey}`;

    const existingTransition = await this.prisma.caseTransition.findUnique({
      where: { idempotencyKey: transitionIdempotencyKey },
    });

    if (existingTransition) {
      const task = await this.findTaskWithinScope(user, taskId);
      if (task.status === TaskStatus.COMPLETED) {
        return toTaskDetail(task);
      }
    }

    const scopedTask = await this.findTaskWithinScope(user, taskId);

    if (scopedTask.status === TaskStatus.COMPLETED) {
      throw new DomainException(
        ErrorCode.TASK_ALREADY_COMPLETED,
        'Bu görev zaten tamamlanmış.',
        HttpStatus.CONFLICT,
      );
    }

    this.assertTaskTypeAllowsCompletion(scopedTask.taskType as TaskTypeCode);
    this.assertTaskCompletable(scopedTask.status as TaskStatusCode);
    this.assertUserCanCompleteTask(user, scopedTask);

    const command = resolveTaskCompletionCommand(scopedTask.taskType as TaskTypeCode);
    if (!command) {
      throw new DomainException(
        ErrorCode.TASK_COMPLETION_NOT_ALLOWED,
        'Bu görev tipi tamamlanarak ilerletilemez.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const snapshotState = scopedTask.case.currentState;
    const snapshotVersion = scopedTask.case.optimisticLockVersion;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scopedTask.caseId}))`;

      const currentTask = await tx.task.findFirst({
        where: {
          id: taskId,
          ...(this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput),
        },
        include: TASK_DETAIL_INCLUDE,
      });

      if (!currentTask) {
        throw new DomainException(
          ErrorCode.TASK_NOT_FOUND,
          'Görev bulunamadı.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (currentTask.status === TaskStatus.COMPLETED) {
        return toTaskDetail(currentTask);
      }

      await this.transitionService.executeInTransaction(
        tx,
        {
          caseId: currentTask.caseId,
          command: command,
          actor: {
            type: AuditActorType.USER,
            userId: user.id,
            roles: user.roles,
            clearanceLevel: user.clearanceLevel,
          },
          idempotencyKey: transitionIdempotencyKey,
          correlationId,
          reason: body.outcome,
        },
        {
          snapshotState: snapshotState as CaseStateCode,
          snapshotVersion,
          companyId: currentTask.case.companyId,
        },
      );

      const completedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          completedByUserId: user.id,
          outcome: body.outcome ?? null,
        },
        include: TASK_DETAIL_INCLUDE,
      });

      await recordTaskEvent(tx, {
        taskId,
        eventType: TaskEventType.COMPLETED,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.TASK_COMPLETED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'task_completed',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'task',
        resourceId: taskId,
        caseId: completedTask.caseId,
        companyId: completedTask.case.companyId,
        correlationId,
        idempotencyKey: `audit:task-completed:${body.idempotencyKey}`,
        metadata: {
          taskId,
          caseId: completedTask.caseId,
          taskType: completedTask.taskType,
        },
      });

      await this.notificationService.enqueueTaskCompleted(tx, {
        taskId,
        caseId: completedTask.caseId,
        taskType: completedTask.taskType,
        correlationId,
        idempotencyKey: body.idempotencyKey,
        completedByUserId: user.id,
      });

      return toTaskDetail(completedTask);
    });
  }

  async delegateTask(
    user: AuthenticatedUser,
    taskId: string,
    body: DelegateTaskBody,
    correlationId: string,
  ): Promise<TaskDetail> {
    const scopedTask = await this.findTaskWithinScope(user, taskId);

    this.assertTaskDelegatable(scopedTask.status as TaskStatusCode);
    this.assertUserCanDelegateTask(user, scopedTask);

    if (body.delegateToUserId === user.id) {
      throw new DomainException(
        ErrorCode.TASK_DELEGATION_NOT_ALLOWED,
        'Görev kendinize devredilemez.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const delegateTarget = await this.prisma.user.findFirst({
      where: {
        id: body.delegateToUserId,
        isActive: true,
        rolesAssigned: {
          some: {
            roleCode: scopedTask.assignedRole,
          },
        },
      },
    });

    if (!delegateTarget) {
      throw new DomainException(
        ErrorCode.TASK_DELEGATION_INVALID_TARGET,
        'Devir hedefi geçersiz veya görev rolüne sahip değil.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scopedTask.caseId}))`;

      const currentTask = await tx.task.findFirst({
        where: {
          id: taskId,
          ...(this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput),
        },
        include: TASK_DETAIL_INCLUDE,
      });

      if (!currentTask) {
        throw new DomainException(
          ErrorCode.TASK_NOT_FOUND,
          'Görev bulunamadı.',
          HttpStatus.NOT_FOUND,
        );
      }

      this.assertTaskDelegatable(currentTask.status as TaskStatusCode);

      const assignedAt = new Date();
      const { dueAt, slaPolicyId } = await this.slaCalculator.calculateDueAt(
        tx,
        currentTask.taskType as TaskTypeCode,
        assignedAt,
      );

      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.DELEGATED },
      });

      const delegatedTask = await tx.task.create({
        data: {
          caseId: currentTask.caseId,
          taskType: currentTask.taskType,
          status: TaskStatus.PENDING,
          assignedRole: currentTask.assignedRole,
          assignedUserId: body.delegateToUserId,
          assignedCompanyId: currentTask.assignedCompanyId,
          assignedFunctionId: currentTask.assignedFunctionId,
          createdByTransitionId: currentTask.createdByTransitionId,
          delegatedFromTaskId: taskId,
          dueAt,
          slaPolicyId,
          createdBy: user.id,
        },
        include: TASK_DETAIL_INCLUDE,
      });

      await recordTaskEvent(tx, {
        taskId,
        eventType: TaskEventType.DELEGATED,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        metadata: {
          fromUserId: currentTask.assignedUserId,
          toUserId: body.delegateToUserId,
          newTaskId: delegatedTask.id,
        },
      });

      await recordTaskEvent(tx, {
        taskId: delegatedTask.id,
        eventType: TaskEventType.CREATED,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        metadata: {
          delegatedFromTaskId: taskId,
          taskType: currentTask.taskType,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.TASK_DELEGATED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'task_delegated',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'task',
        resourceId: delegatedTask.id,
        caseId: delegatedTask.caseId,
        companyId: delegatedTask.case.companyId,
        correlationId,
        idempotencyKey: `audit:task-delegated:${taskId}:${body.delegateToUserId}`,
        metadata: {
          originalTaskId: taskId,
          newTaskId: delegatedTask.id,
          fromUserId: currentTask.assignedUserId,
          toUserId: body.delegateToUserId,
          caseId: delegatedTask.caseId,
          taskType: delegatedTask.taskType,
        },
      });

      await this.notificationService.enqueueTaskDelegated(tx, {
        taskId: delegatedTask.id,
        caseId: delegatedTask.caseId,
        delegateToUserId: body.delegateToUserId,
        correlationId,
        idempotencyKey: `${taskId}:${body.delegateToUserId}`,
      });

      return toTaskDetail(delegatedTask);
    });
  }

  private buildListFilterScope(query: ListTasksQuery): Prisma.TaskWhereInput {
    const scope: Prisma.TaskWhereInput = {};

    if (query.status?.length) {
      for (const status of query.status) {
        if (!TASK_STATUS_VALUES.includes(status as TaskStatusCode)) {
          throw new DomainException(
            ErrorCode.VALIDATION_FAILED,
            `Geçersiz görev durumu: ${status}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      scope.status = { in: query.status };
    }

    if (query.taskType) {
      scope.taskType = query.taskType;
    }

    if (query.caseId) {
      scope.caseId = query.caseId;
    }

    if (query.dueBefore || query.dueAfter) {
      scope.dueAt = {
        ...(query.dueBefore ? { lte: new Date(query.dueBefore) } : {}),
        ...(query.dueAfter ? { gte: new Date(query.dueAfter) } : {}),
      };
    }

    return scope;
  }

  private resolveRowSortValue(
    row: TaskWithCase,
    sortField: ReturnType<typeof resolveTaskSortField>,
  ): string {
    switch (sortField) {
      case 'dueAt':
        return toTaskSortValue(row.dueAt);
      case 'status':
        return row.status;
      case 'createdAt':
      default:
        return toTaskSortValue(row.createdAt);
    }
  }

  private async findTaskWithinScope(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<TaskWithCase> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        ...(this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput),
      },
      include: TASK_DETAIL_INCLUDE,
    });

    if (!task) {
      throw new DomainException(
        ErrorCode.TASK_NOT_FOUND,
        'Görev bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    return task;
  }

  private assertTaskCompletable(status: TaskStatusCode): void {
    if (status !== TaskStatus.PENDING && status !== TaskStatus.IN_PROGRESS) {
      throw new DomainException(
        ErrorCode.TASK_INVALID_STATE,
        'Görev mevcut durumda tamamlanamaz.',
        HttpStatus.CONFLICT,
      );
    }
  }

  private assertTaskDelegatable(status: TaskStatusCode): void {
    if (status !== TaskStatus.PENDING && status !== TaskStatus.IN_PROGRESS) {
      throw new DomainException(
        ErrorCode.TASK_INVALID_STATE,
        'Görev mevcut durumda devredilemez.',
        HttpStatus.CONFLICT,
      );
    }
  }

  private assertUserCanDelegateTask(user: AuthenticatedUser, task: TaskWithCase): void {
    if (task.assignedUserId) {
      if (task.assignedUserId !== user.id) {
        throw new DomainException(
          ErrorCode.TASK_NOT_FOUND,
          'Görev bulunamadı.',
          HttpStatus.NOT_FOUND,
        );
      }
      return;
    }

    if (!user.roles.includes(task.assignedRole as AuthenticatedUser['roles'][number])) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu görevi devretme yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertTaskTypeAllowsCompletion(taskType: TaskTypeCode): void {
    if (TASK_TYPES_WITHOUT_COMPLETION.includes(taskType)) {
      throw new DomainException(
        ErrorCode.TASK_COMPLETION_NOT_ALLOWED,
        'Bu görev tipi tamamlama API üzerinden ilerletilemez.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertUserCanCompleteTask(user: AuthenticatedUser, task: TaskWithCase): void {
    if (task.assignedUserId) {
      if (task.assignedUserId !== user.id) {
        throw new DomainException(
          ErrorCode.TASK_NOT_FOUND,
          'Görev bulunamadı.',
          HttpStatus.NOT_FOUND,
        );
      }
      return;
    }

    if (!user.roles.includes(task.assignedRole as AuthenticatedUser['roles'][number])) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu görevi tamamlama yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async listActiveCouncilMemberIds(tx: Prisma.TransactionClient): Promise<string[]> {
    const members = await tx.user.findMany({
      where: {
        isActive: true,
        rolesAssigned: {
          some: {
            roleCode: Role.COUNCIL_MEMBER,
            isActive: true,
          },
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    return members.map((member) => member.id);
  }
}
