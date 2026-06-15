export { listTasksQuerySchema, type ListTasksQuery } from './list-tasks-query.schema.js';

export {
  unifiedWorkItemListItemSchema,
  workflowTaskListItemSchema,
  approvalWorkItemListItemSchema,
  unifiedWorkItemDetailSchema,
  workflowTaskDetailSchema,
  approvalWorkItemDetailSchema,
  decideTaskBodySchema,
  decideTaskResponseSchema,
  listTasksResponseSchema,
  taskPaginationSchema,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- backward-compatible re-export
  taskListItemSchema,
  taskDetailSchema,
  taskDetailResponseSchema,
  completeTaskResponseSchema,
  type UnifiedWorkItemListItem,
  type WorkflowTaskListItem,
  type ApprovalWorkItemListItem,
  type UnifiedWorkItemDetail,
  type WorkflowTaskDetail,
  type ApprovalWorkItemDetail,
  type DecideTaskBody,
  type DecideTaskResponse,
  type ListTasksResponse,
  type TaskListItem,
  type TaskPagination,
  type TaskDetail,
  type TaskDetailResponse,
} from './unified-work-item.schema.js';

export {
  completeTaskBodySchema,
  taskDetailCaseSchema,
  type CompleteTaskBody,
  type TaskDetailCase,
  type CompleteTaskResponse,
} from './complete-task.schema.js';

export {
  delegateTaskBodySchema,
  delegateTaskResponseSchema,
  type DelegateTaskBody,
  type DelegateTaskResponse,
} from './delegate-task.schema.js';
