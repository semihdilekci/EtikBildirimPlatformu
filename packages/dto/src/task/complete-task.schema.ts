import { z } from 'zod';

import {
  completeTaskResponseSchema,
  unifiedWorkItemDetailSchema,
  workflowTaskDetailSchema,
  type CompleteTaskResponse,
  type UnifiedWorkItemDetail,
  type WorkflowTaskDetail,
} from './unified-work-item.schema.js';

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

export {
  completeTaskResponseSchema,
  workflowTaskDetailSchema,
  type CompleteTaskResponse,
  type WorkflowTaskDetail,
};

/** Workflow-only task detail (complete/delegate yanıtları) */
export type TaskDetail = WorkflowTaskDetail;

export const taskDetailSchema = workflowTaskDetailSchema;

export const taskDetailResponseSchema = z.object({
  data: unifiedWorkItemDetailSchema,
});

export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;

export type { UnifiedWorkItemDetail };
