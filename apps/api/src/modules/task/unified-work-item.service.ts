import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import type {
  DecideTaskBody,
  ListTasksQuery,
  UnifiedWorkItemDetail,
  UnifiedWorkItemListItem,
} from '@ethics/dto';
import {
  APPROVAL_WORK_ITEM_STATUS_VALUES,
  ApprovalWorkItemStatus,
  ApprovalWorkItemTargetType,
  ErrorCode,
  TASK_STATUS_VALUES,
  WorkItemKind,
  type ApprovalWorkItemStatusCode,
  type TaskStatusCode,
} from '@ethics/shared';
import type { ApprovalWorkItem, Prisma } from '@prisma/client';

import { PolicyScopeService } from '../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminUsersService } from '../admin/users/admin-users.service.js';
import { ConfigService } from '../admin/config/config.service.js';
import { FieldVisibilityAdminService } from '../admin/config/field-visibility.service.js';
import { ActionMatrixAdminService } from '../admin/config/action-matrix.service.js';
import { SlaPolicyAdminService } from '../admin/sla/sla-policy-admin.service.js';
import { NotificationTemplateAdminService } from '../admin/notification/notification-template-admin.service.js';
import { KvkkTextAdminService } from '../admin/kvkk/kvkk-text-admin.service.js';
import {
  buildTaskCursorSortCondition,
  decodeTaskListCursor,
  resolveTaskSortField,
  toTaskSortValue,
} from './task-pagination.util.js';
import { TASK_DETAIL_INCLUDE, type TaskWithCase } from './task.mapper.js';
import {
  toApprovalWorkItemDetail,
  toApprovalWorkItemListItem,
  toWorkflowTaskDetail,
  toWorkflowTaskListItem,
} from './unified-work-item.mapper.js';

const APPROVAL_WORK_ITEM_INCLUDE = {
  requestedByUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
} as const satisfies Prisma.ApprovalWorkItemInclude;

type ApprovalWorkItemRow = ApprovalWorkItem & {
  requestedByUser: { id: string; displayName: string };
};

interface UnifiedListCursorPayload {
  kind: typeof WorkItemKind.WORKFLOW | typeof WorkItemKind.APPROVAL;
  id: string;
  sortValue: string;
}

interface UnifiedSortableRow {
  kind: typeof WorkItemKind.WORKFLOW | typeof WorkItemKind.APPROVAL;
  id: string;
  sortValue: string;
  item: UnifiedWorkItemListItem;
}

@Injectable()
export class UnifiedWorkItemService {
  private adminUsersServiceRef: AdminUsersService | null = null;
  private configServiceRef: ConfigService | null = null;
  private fieldVisibilityAdminServiceRef: FieldVisibilityAdminService | null = null;
  private actionMatrixAdminServiceRef: ActionMatrixAdminService | null = null;
  private slaPolicyAdminServiceRef: SlaPolicyAdminService | null = null;
  private notificationTemplateAdminServiceRef: NotificationTemplateAdminService | null = null;
  private kvkkTextAdminServiceRef: KvkkTextAdminService | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyScopeService) private readonly policyScope: PolicyScopeService,
    @Optional()
    @Inject(AdminUsersService)
    private readonly adminUsersServiceInjected?: AdminUsersService,
    @Optional() @Inject(ConfigService) private readonly configServiceInjected?: ConfigService,
    @Optional()
    @Inject(FieldVisibilityAdminService)
    private readonly fieldVisibilityAdminServiceInjected?: FieldVisibilityAdminService,
    @Optional()
    @Inject(ActionMatrixAdminService)
    private readonly actionMatrixAdminServiceInjected?: ActionMatrixAdminService,
    @Optional()
    @Inject(SlaPolicyAdminService)
    private readonly slaPolicyAdminServiceInjected?: SlaPolicyAdminService,
    @Optional()
    @Inject(NotificationTemplateAdminService)
    private readonly notificationTemplateAdminServiceInjected?: NotificationTemplateAdminService,
    @Optional()
    @Inject(KvkkTextAdminService)
    private readonly kvkkTextAdminServiceInjected?: KvkkTextAdminService,
  ) {}

  wireAdminUsersServiceForTests(adminUsersService: AdminUsersService): void {
    this.adminUsersServiceRef = adminUsersService;
  }

  wireConfigServiceForTests(configService: ConfigService): void {
    this.configServiceRef = configService;
  }

  wireFieldVisibilityAdminServiceForTests(
    fieldVisibilityAdminService: FieldVisibilityAdminService,
  ): void {
    this.fieldVisibilityAdminServiceRef = fieldVisibilityAdminService;
  }

  wireActionMatrixAdminServiceForTests(actionMatrixAdminService: ActionMatrixAdminService): void {
    this.actionMatrixAdminServiceRef = actionMatrixAdminService;
  }

  wireSlaPolicyAdminServiceForTests(slaPolicyAdminService: SlaPolicyAdminService): void {
    this.slaPolicyAdminServiceRef = slaPolicyAdminService;
  }

  wireNotificationTemplateAdminServiceForTests(
    notificationTemplateAdminService: NotificationTemplateAdminService,
  ): void {
    this.notificationTemplateAdminServiceRef = notificationTemplateAdminService;
  }

  wireKvkkTextAdminServiceForTests(kvkkTextAdminService: KvkkTextAdminService): void {
    this.kvkkTextAdminServiceRef = kvkkTextAdminService;
  }

  private get adminUsersService(): AdminUsersService {
    const service = this.adminUsersServiceRef ?? this.adminUsersServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'AdminUsersService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  private get configService(): ConfigService {
    const service = this.configServiceRef ?? this.configServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'ConfigService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  private get fieldVisibilityAdminService(): FieldVisibilityAdminService {
    const service = this.fieldVisibilityAdminServiceRef ?? this.fieldVisibilityAdminServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'FieldVisibilityAdminService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  private get actionMatrixAdminService(): ActionMatrixAdminService {
    const service = this.actionMatrixAdminServiceRef ?? this.actionMatrixAdminServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'ActionMatrixAdminService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  private get slaPolicyAdminService(): SlaPolicyAdminService {
    const service = this.slaPolicyAdminServiceRef ?? this.slaPolicyAdminServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'SlaPolicyAdminService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  private get notificationTemplateAdminService(): NotificationTemplateAdminService {
    const service =
      this.notificationTemplateAdminServiceRef ?? this.notificationTemplateAdminServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'NotificationTemplateAdminService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  private get kvkkTextAdminService(): KvkkTextAdminService {
    const service = this.kvkkTextAdminServiceRef ?? this.kvkkTextAdminServiceInjected;
    if (!service) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'KvkkTextAdminService kullanılamıyor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return service;
  }

  async listItems(
    user: AuthenticatedUser,
    query: ListTasksQuery,
  ): Promise<{
    data: UnifiedWorkItemListItem[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    if (query.kind === WorkItemKind.WORKFLOW) {
      return this.listWorkflowItems(user, query);
    }

    if (query.kind === WorkItemKind.APPROVAL) {
      return this.listApprovalItems(user, query);
    }

    return this.listMergedItems(user, query);
  }

  async getItemDetail(user: AuthenticatedUser, itemId: string): Promise<UnifiedWorkItemDetail> {
    const workflowTask = await this.prisma.task.findFirst({
      where: {
        id: itemId,
        ...(this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput),
      },
      include: TASK_DETAIL_INCLUDE,
    });

    if (workflowTask) {
      return toWorkflowTaskDetail(workflowTask);
    }

    const approvalItem = await this.findApprovalItemForUser(user, itemId);
    if (approvalItem) {
      return toApprovalWorkItemDetail(approvalItem, user);
    }

    throw new DomainException(ErrorCode.TASK_NOT_FOUND, 'Görev bulunamadı.', HttpStatus.NOT_FOUND);
  }

  async decideApprovalWorkItem(
    user: AuthenticatedUser,
    workItemId: string,
    body: DecideTaskBody,
    correlationId: string,
  ): Promise<{
    workItem: ReturnType<typeof toApprovalWorkItemDetail>;
    domainResult: Record<string, unknown>;
  }> {
    const item = await this.prisma.approvalWorkItem.findUnique({
      where: { id: workItemId },
      include: APPROVAL_WORK_ITEM_INCLUDE,
    });

    if (!item) {
      throw new DomainException(
        ErrorCode.APPROVAL_WORK_ITEM_NOT_FOUND,
        'Onay işi bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!this.canViewApprovalItem(user, item)) {
      throw new DomainException(
        ErrorCode.APPROVAL_WORK_ITEM_NOT_FOUND,
        'Onay işi bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (item.status !== ApprovalWorkItemStatus.PENDING) {
      throw new DomainException(
        ErrorCode.APPROVAL_WORK_ITEM_ALREADY_DECIDED,
        'Bu onay işi zaten karara bağlanmış.',
        HttpStatus.CONFLICT,
      );
    }

    const domainResult = await this.delegateDecision(user, item, body, correlationId);

    const updated = await this.prisma.approvalWorkItem.findUniqueOrThrow({
      where: { id: workItemId },
      include: APPROVAL_WORK_ITEM_INCLUDE,
    });

    return {
      workItem: toApprovalWorkItemDetail(updated, user),
      domainResult,
    };
  }

  private async listWorkflowItems(
    user: AuthenticatedUser,
    query: ListTasksQuery,
  ): Promise<{
    data: UnifiedWorkItemListItem[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    const policyScope = this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput;
    const filterScope = this.buildWorkflowFilterScope(query);
    const sortField = resolveTaskSortField(query.sortBy);
    const take = query.limit + 1;
    const whereConditions: Prisma.TaskWhereInput[] = [policyScope, filterScope];

    if (query.cursor) {
      try {
        const cursorPayload = decodeUnifiedListCursor(query.cursor);
        if (cursorPayload.kind !== WorkItemKind.WORKFLOW) {
          throw new Error('Invalid cursor kind');
        }
        whereConditions.push(
          buildTaskCursorSortCondition(sortField, query.sortOrder, {
            id: cursorPayload.id,
            sortValue: cursorPayload.sortValue,
          }),
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
      data: pageRows.map(toWorkflowTaskListItem),
      pagination: {
        nextCursor:
          hasMore && lastRow
            ? encodeUnifiedListCursor({
                kind: WorkItemKind.WORKFLOW,
                id: lastRow.id,
                sortValue: this.resolveWorkflowSortValue(lastRow, sortField),
              })
            : null,
        hasMore,
        total: null,
      },
    };
  }

  private async listApprovalItems(
    user: AuthenticatedUser,
    query: ListTasksQuery,
  ): Promise<{
    data: UnifiedWorkItemListItem[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    const sortField = resolveTaskSortField(query.sortBy);
    const take = query.limit + 1;
    const whereConditions: Prisma.ApprovalWorkItemWhereInput[] = [
      this.buildApprovalVisibilityScope(user),
      this.buildApprovalFilterScope(query),
    ];

    if (query.cursor) {
      try {
        const cursorPayload = decodeUnifiedListCursor(query.cursor);
        if (cursorPayload.kind !== WorkItemKind.APPROVAL) {
          throw new Error('Invalid cursor kind');
        }
        whereConditions.push(
          buildApprovalCursorSortCondition(sortField, query.sortOrder, cursorPayload),
        );
      } catch {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Geçersiz sayfalama imleci.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.prisma.approvalWorkItem.findMany({
      where: { AND: whereConditions },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      take,
      include: APPROVAL_WORK_ITEM_INCLUDE,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const lastRow = pageRows.at(-1);

    return {
      data: pageRows.map(toApprovalWorkItemListItem),
      pagination: {
        nextCursor:
          hasMore && lastRow
            ? encodeUnifiedListCursor({
                kind: WorkItemKind.APPROVAL,
                id: lastRow.id,
                sortValue: this.resolveApprovalSortValue(lastRow, sortField),
              })
            : null,
        hasMore,
        total: null,
      },
    };
  }

  private async listMergedItems(
    user: AuthenticatedUser,
    query: ListTasksQuery,
  ): Promise<{
    data: UnifiedWorkItemListItem[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    const sortField = resolveTaskSortField(query.sortBy);
    const fetchSize = query.limit + 1;

    if (query.cursor) {
      try {
        decodeUnifiedListCursor(query.cursor);
      } catch {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Geçersiz sayfalama imleci.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const [workflowRows, approvalRows] = await Promise.all([
      this.fetchWorkflowRowsForMerge(user, query, sortField, fetchSize),
      this.fetchApprovalRowsForMerge(user, query, sortField, fetchSize),
    ]);

    const merged = [...workflowRows, ...approvalRows]
      .sort((left, right) => compareUnifiedRows(left, right, query.sortOrder))
      .slice(0, fetchSize);

    const hasMore = merged.length > query.limit;
    const pageRows = hasMore ? merged.slice(0, query.limit) : merged;
    const lastRow = pageRows.at(-1);

    return {
      data: pageRows.map((row) => row.item),
      pagination: {
        nextCursor:
          hasMore && lastRow
            ? encodeUnifiedListCursor({
                kind: lastRow.kind,
                id: lastRow.id,
                sortValue: lastRow.sortValue,
              })
            : null,
        hasMore,
        total: null,
      },
    };
  }

  private async fetchWorkflowRowsForMerge(
    user: AuthenticatedUser,
    query: ListTasksQuery,
    sortField: ReturnType<typeof resolveTaskSortField>,
    fetchSize: number,
  ): Promise<UnifiedSortableRow[]> {
    const policyScope = this.policyScope.buildTaskScope(user) as Prisma.TaskWhereInput;
    const filterScope = this.buildWorkflowFilterScope(query);
    const whereConditions: Prisma.TaskWhereInput[] = [policyScope, filterScope];

    if (query.cursor) {
      const cursorPayload = decodeUnifiedListCursor(query.cursor);
      whereConditions.push(buildMergedCursorCondition(sortField, query.sortOrder, cursorPayload));
    }

    const rows = (await this.prisma.task.findMany({
      where: { AND: whereConditions },
      orderBy: [{ [sortField]: query.sortOrder }, { id: query.sortOrder }],
      take: fetchSize,
      include: TASK_DETAIL_INCLUDE,
    })) as TaskWithCase[];

    return rows.map((row) => ({
      kind: WorkItemKind.WORKFLOW,
      id: row.id,
      sortValue: this.resolveWorkflowSortValue(row, sortField),
      item: toWorkflowTaskListItem(row),
    }));
  }

  private async fetchApprovalRowsForMerge(
    user: AuthenticatedUser,
    query: ListTasksQuery,
    sortField: ReturnType<typeof resolveTaskSortField>,
    fetchSize: number,
  ): Promise<UnifiedSortableRow[]> {
    const whereConditions: Prisma.ApprovalWorkItemWhereInput[] = [
      this.buildApprovalVisibilityScope(user),
      this.buildApprovalFilterScope(query),
    ];

    if (query.cursor) {
      const cursorPayload = decodeUnifiedListCursor(query.cursor);
      whereConditions.push(buildMergedCursorCondition(sortField, query.sortOrder, cursorPayload));
    }

    const rows = await this.prisma.approvalWorkItem.findMany({
      where: { AND: whereConditions },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      take: fetchSize,
      include: APPROVAL_WORK_ITEM_INCLUDE,
    });

    return rows.map((row) => ({
      kind: WorkItemKind.APPROVAL,
      id: row.id,
      sortValue: this.resolveApprovalSortValue(row, sortField),
      item: toApprovalWorkItemListItem(row),
    }));
  }

  private buildWorkflowFilterScope(query: ListTasksQuery): Prisma.TaskWhereInput {
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

  private buildApprovalFilterScope(query: ListTasksQuery): Prisma.ApprovalWorkItemWhereInput {
    const scope: Prisma.ApprovalWorkItemWhereInput = {};

    if (query.status?.length) {
      const approvalStatuses = query.status.filter((status) =>
        APPROVAL_WORK_ITEM_STATUS_VALUES.includes(status as ApprovalWorkItemStatusCode),
      );

      if (approvalStatuses.length > 0) {
        scope.status = { in: approvalStatuses };
      } else {
        scope.status = ApprovalWorkItemStatus.PENDING;
      }
    }

    return scope;
  }

  private buildApprovalVisibilityScope(user: AuthenticatedUser): Prisma.ApprovalWorkItemWhereInput {
    return {
      OR: [{ assignedCheckerRole: { in: [...user.roles] } }, { requestedBy: user.id }],
    };
  }

  private canViewApprovalItem(
    user: AuthenticatedUser,
    item: Pick<ApprovalWorkItem, 'assignedCheckerRole' | 'requestedBy'>,
  ): boolean {
    return (
      user.roles.includes(item.assignedCheckerRole as (typeof user.roles)[number]) ||
      user.id === item.requestedBy
    );
  }

  private async findApprovalItemForUser(
    user: AuthenticatedUser,
    itemId: string,
  ): Promise<ApprovalWorkItemRow | null> {
    const item = await this.prisma.approvalWorkItem.findFirst({
      where: {
        id: itemId,
        ...this.buildApprovalVisibilityScope(user),
      },
      include: APPROVAL_WORK_ITEM_INCLUDE,
    });

    return item;
  }

  private async delegateDecision(
    user: AuthenticatedUser,
    item: ApprovalWorkItemRow,
    body: DecideTaskBody,
    correlationId: string,
  ): Promise<Record<string, unknown>> {
    switch (item.targetType) {
      case ApprovalWorkItemTargetType.USER_ROLE: {
        const roleAssignment = await this.prisma.userRole.findUnique({
          where: { id: item.targetId },
        });

        if (!roleAssignment) {
          throw new DomainException(
            ErrorCode.ADMIN_ROLE_NOT_FOUND,
            'Onay bekleyen rol ataması bulunamadı.',
            HttpStatus.NOT_FOUND,
          );
        }

        return this.adminUsersService.approveRoleAssignment(
          user,
          roleAssignment.userId,
          item.targetId,
          body,
          correlationId,
        );
      }
      case ApprovalWorkItemTargetType.CLEARANCE_REQUEST: {
        const request = await this.prisma.clearanceChangeRequest.findUnique({
          where: { id: item.targetId },
        });

        if (!request) {
          throw new DomainException(
            ErrorCode.ADMIN_CLEARANCE_REQUEST_NOT_FOUND,
            'Onay bekleyen clearance değişikliği bulunamadı.',
            HttpStatus.NOT_FOUND,
          );
        }

        return this.adminUsersService.approveClearanceChange(
          user,
          request.userId,
          item.targetId,
          body,
          correlationId,
        );
      }
      case ApprovalWorkItemTargetType.SYSTEM_SETTING_BATCH:
        return this.configService.approveSystemSettingBatch(
          user,
          item.targetId,
          body,
          correlationId,
        );
      case ApprovalWorkItemTargetType.FIELD_VISIBILITY_BATCH:
        return this.fieldVisibilityAdminService.approveBatch(
          user,
          item.targetId,
          body,
          correlationId,
        );
      case ApprovalWorkItemTargetType.ACTION_MATRIX_BATCH:
        return this.actionMatrixAdminService.approveBatch(user, item.targetId, body, correlationId);
      case ApprovalWorkItemTargetType.SLA_POLICY_BATCH:
        return this.slaPolicyAdminService.approveBatch(user, item.targetId, body, correlationId);
      case ApprovalWorkItemTargetType.NOTIFICATION_TEMPLATE_BATCH:
        return this.notificationTemplateAdminService.approveBatch(
          user,
          item.targetId,
          body,
          correlationId,
        );
      case ApprovalWorkItemTargetType.KVKK_TEXT_BATCH:
        return this.kvkkTextAdminService.approveBatch(user, item.targetId, body, correlationId);
      default:
        throw new DomainException(
          ErrorCode.APPROVAL_WORK_ITEM_UNSUPPORTED,
          'Bu onay kategorisi henüz görev kuyruğundan karar verilemiyor.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
    }
  }

  private resolveWorkflowSortValue(
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

  private resolveApprovalSortValue(
    row: ApprovalWorkItem,
    sortField: ReturnType<typeof resolveTaskSortField>,
  ): string {
    switch (sortField) {
      case 'status':
        return row.status;
      case 'dueAt':
        return '';
      case 'createdAt':
      default:
        return toTaskSortValue(row.createdAt);
    }
  }
}

function encodeUnifiedListCursor(payload: UnifiedListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeUnifiedListCursor(cursor: string): UnifiedListCursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<UnifiedListCursorPayload>;

    if (
      (parsed.kind !== WorkItemKind.WORKFLOW && parsed.kind !== WorkItemKind.APPROVAL) ||
      typeof parsed.id !== 'string' ||
      typeof parsed.sortValue !== 'string'
    ) {
      throw new Error('Invalid cursor payload');
    }

    return {
      kind: parsed.kind,
      id: parsed.id,
      sortValue: parsed.sortValue,
    };
  } catch {
    try {
      const legacy = decodeTaskListCursor(cursor);
      return {
        kind: WorkItemKind.WORKFLOW,
        id: legacy.id,
        sortValue: legacy.sortValue,
      };
    } catch {
      throw new Error('Invalid cursor');
    }
  }
}

function buildApprovalCursorSortCondition(
  sortField: ReturnType<typeof resolveTaskSortField>,
  sortOrder: ListTasksQuery['sortOrder'],
  cursor: UnifiedListCursorPayload,
): Prisma.ApprovalWorkItemWhereInput {
  const comparator = sortOrder === 'desc' ? 'lt' : 'gt';
  const tieComparator = sortOrder === 'desc' ? 'lt' : 'gt';

  if (sortField === 'status') {
    return {
      OR: [
        { status: { [comparator]: cursor.sortValue } },
        {
          AND: [{ status: cursor.sortValue }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  return {
    OR: [
      { createdAt: { [comparator]: new Date(cursor.sortValue) } },
      {
        AND: [{ createdAt: new Date(cursor.sortValue) }, { id: { [tieComparator]: cursor.id } }],
      },
    ],
  };
}

function buildMergedCursorCondition(
  sortField: ReturnType<typeof resolveTaskSortField>,
  sortOrder: ListTasksQuery['sortOrder'],
  cursor: UnifiedListCursorPayload,
): Record<string, unknown> {
  const comparator = sortOrder === 'desc' ? 'lt' : 'gt';
  const tieComparator = sortOrder === 'desc' ? 'lt' : 'gt';

  if (sortField === 'status') {
    return {
      OR: [
        { status: { [comparator]: cursor.sortValue } },
        {
          AND: [{ status: cursor.sortValue }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  if (sortField === 'dueAt') {
    const cursorDate = cursor.sortValue ? new Date(cursor.sortValue) : null;
    return {
      OR: [
        { dueAt: { [comparator]: cursorDate } },
        {
          AND: [{ dueAt: cursorDate }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  return {
    OR: [
      { createdAt: { [comparator]: new Date(cursor.sortValue) } },
      {
        AND: [{ createdAt: new Date(cursor.sortValue) }, { id: { [tieComparator]: cursor.id } }],
      },
    ],
  };
}

function compareUnifiedRows(
  left: UnifiedSortableRow,
  right: UnifiedSortableRow,
  sortOrder: ListTasksQuery['sortOrder'],
): number {
  const direction = sortOrder === 'desc' ? -1 : 1;

  if (left.sortValue < right.sortValue) {
    return -1 * direction;
  }

  if (left.sortValue > right.sortValue) {
    return 1 * direction;
  }

  if (left.id < right.id) {
    return -1 * direction;
  }

  if (left.id > right.id) {
    return 1 * direction;
  }

  return 0;
}

export { decodeUnifiedListCursor, encodeUnifiedListCursor };
