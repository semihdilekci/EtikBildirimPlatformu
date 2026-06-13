import { TASK_STATUS_VALUES, TASK_TYPE_VALUES } from '@ethics/shared';
import { z } from 'zod';

const taskSortByValues = ['createdAt', 'dueAt', 'status'] as const;

export const listTasksQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) =>
      value
        ?.split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  taskType: z.enum(TASK_TYPE_VALUES as [string, ...string[]]).optional(),
  caseId: z.string().min(1).optional(),
  dueBefore: z.string().datetime({ offset: true }).optional(),
  dueAfter: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().min(1).optional(),
  sortBy: z.enum(taskSortByValues).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const taskListItemSchema = z.object({
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

export type TaskListItem = z.infer<typeof taskListItemSchema>;

export const taskPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.null(),
});

export type TaskPagination = z.infer<typeof taskPaginationSchema>;

export const listTasksResponseSchema = z.object({
  data: z.array(taskListItemSchema),
  pagination: taskPaginationSchema,
});

export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;
