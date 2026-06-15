import { TASK_TYPE_VALUES, WORK_ITEM_KIND_VALUES } from '@ethics/shared';
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
  kind: z.enum(WORK_ITEM_KIND_VALUES as [string, ...string[]]).optional(),
  caseId: z.string().min(1).optional(),
  dueBefore: z.string().datetime({ offset: true }).optional(),
  dueAfter: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().min(1).optional(),
  sortBy: z.enum(taskSortByValues).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
