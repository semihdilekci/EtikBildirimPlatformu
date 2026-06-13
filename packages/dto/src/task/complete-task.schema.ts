import { TASK_STATUS_VALUES, TASK_TYPE_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const completeTaskBodySchema = z.object({
  outcome: z.string().min(1).max(4000).optional(),
  idempotencyKey: z.string().uuid(),
});

export type CompleteTaskBody = z.infer<typeof completeTaskBodySchema>;

export const taskDetailCaseSchema = z.object({
  id: z.string(),
  currentState: z.string(),
  currentStateLabel: z.string(),
  confidentialityLevel: z.string(),
  companyId: z.string(),
  companyName: z.string(),
});

export type TaskDetailCase = z.infer<typeof taskDetailCaseSchema>;

export const taskDetailSchema = z.object({
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

export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const completeTaskResponseSchema = z.object({
  data: taskDetailSchema,
});

export type CompleteTaskResponse = z.infer<typeof completeTaskResponseSchema>;

export const taskDetailResponseSchema = z.object({
  data: taskDetailSchema,
});

export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;
