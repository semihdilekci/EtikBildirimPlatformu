import {
  APPROVAL_CATEGORY_VALUES,
  APPROVAL_WORK_ITEM_STATUS_VALUES,
  APPROVAL_WORK_ITEM_TARGET_TYPE_VALUES,
  TASK_STATUS_VALUES,
  TASK_TYPE_VALUES,
  WorkItemKind,
} from '@ethics/shared';
import { z } from 'zod';

const taskDetailCaseSchema = z.object({
  id: z.string(),
  currentState: z.string(),
  currentStateLabel: z.string(),
  confidentialityLevel: z.string(),
  companyId: z.string(),
  companyName: z.string(),
});

export const workflowTaskListItemSchema = z.object({
  kind: z.literal(WorkItemKind.WORKFLOW),
  id: z.string(),
  caseId: z.string(),
  taskType: z.enum(TASK_TYPE_VALUES as [string, ...string[]]),
  taskTypeLabel: z.string(),
  status: z.enum(TASK_STATUS_VALUES as [string, ...string[]]),
  assignedRole: z.string(),
  dueAt: z.string().datetime().nullable(),
  slaStatus: z.enum(['ON_TRACK', 'WARNING', 'OVERDUE']).nullable(),
  createdAt: z.string().datetime(),
});

export type WorkflowTaskListItem = z.infer<typeof workflowTaskListItemSchema>;

export const approvalWorkItemListItemSchema = z.object({
  kind: z.literal(WorkItemKind.APPROVAL),
  id: z.string(),
  caseId: z.null(),
  approvalCategory: z.enum(APPROVAL_CATEGORY_VALUES as [string, ...string[]]),
  approvalCategoryLabel: z.string(),
  status: z.enum(APPROVAL_WORK_ITEM_STATUS_VALUES as [string, ...string[]]),
  assignedRole: z.string(),
  summary: z.string(),
  requestedByDisplayName: z.string(),
  requestedAt: z.string().datetime(),
  dueAt: z.null(),
  slaStatus: z.null(),
  createdAt: z.string().datetime(),
});

export type ApprovalWorkItemListItem = z.infer<typeof approvalWorkItemListItemSchema>;

export const unifiedWorkItemListItemSchema = z.discriminatedUnion('kind', [
  workflowTaskListItemSchema,
  approvalWorkItemListItemSchema,
]);

export type UnifiedWorkItemListItem = z.infer<typeof unifiedWorkItemListItemSchema>;

export const workflowTaskDetailSchema = z.object({
  kind: z.literal(WorkItemKind.WORKFLOW),
  id: z.string(),
  caseId: z.string(),
  taskType: z.enum(TASK_TYPE_VALUES as [string, ...string[]]),
  taskTypeLabel: z.string(),
  status: z.enum(TASK_STATUS_VALUES as [string, ...string[]]),
  assignedRole: z.string(),
  assignedUserId: z.string().nullable(),
  delegatedFromTaskId: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  slaStatus: z.enum(['ON_TRACK', 'WARNING', 'OVERDUE']).nullable(),
  outcome: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  case: taskDetailCaseSchema,
});

export type WorkflowTaskDetail = z.infer<typeof workflowTaskDetailSchema>;

export const approvalWorkItemDetailSchema = z.object({
  kind: z.literal(WorkItemKind.APPROVAL),
  id: z.string(),
  approvalCategory: z.enum(APPROVAL_CATEGORY_VALUES as [string, ...string[]]),
  approvalCategoryLabel: z.string(),
  status: z.enum(APPROVAL_WORK_ITEM_STATUS_VALUES as [string, ...string[]]),
  summary: z.string(),
  assignedRole: z.string(),
  requestedBy: z.string(),
  requestedByDisplayName: z.string(),
  requestedAt: z.string().datetime(),
  canDecide: z.boolean(),
  targetType: z.enum(APPROVAL_WORK_ITEM_TARGET_TYPE_VALUES as [string, ...string[]]),
  targetId: z.string(),
  decidedAt: z.string().datetime().nullable(),
  decisionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type ApprovalWorkItemDetail = z.infer<typeof approvalWorkItemDetailSchema>;

export const unifiedWorkItemDetailSchema = z.discriminatedUnion('kind', [
  workflowTaskDetailSchema,
  approvalWorkItemDetailSchema,
]);

export type UnifiedWorkItemDetail = z.infer<typeof unifiedWorkItemDetailSchema>;

export const decideTaskBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type DecideTaskBody = z.infer<typeof decideTaskBodySchema>;

export const decideTaskResponseSchema = z.object({
  data: z.object({
    workItem: approvalWorkItemDetailSchema,
    domainResult: z.record(z.unknown()),
  }),
});

export type DecideTaskResponse = z.infer<typeof decideTaskResponseSchema>;

/** @deprecated Use unifiedWorkItemListItemSchema — kept for backward-compatible imports */
export const taskListItemSchema = unifiedWorkItemListItemSchema;

/** Birleşik liste satırı */
export type TaskListItem = UnifiedWorkItemListItem;

/** Workflow görev detayı (complete/delegate yanıtları) */
export type TaskDetail = WorkflowTaskDetail;

export const taskDetailSchema = workflowTaskDetailSchema;

export const taskDetailResponseSchema = z.object({
  data: unifiedWorkItemDetailSchema,
});

export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;

export const listTasksResponseSchema = z.object({
  data: z.array(unifiedWorkItemListItemSchema),
  pagination: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    total: z.null(),
  }),
});

export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;

export const taskPaginationSchema = listTasksResponseSchema.shape.pagination;

export type TaskPagination = z.infer<typeof taskPaginationSchema>;

export const completeTaskResponseSchema = z.object({
  data: workflowTaskDetailSchema,
});

export type CompleteTaskResponse = z.infer<typeof completeTaskResponseSchema>;
