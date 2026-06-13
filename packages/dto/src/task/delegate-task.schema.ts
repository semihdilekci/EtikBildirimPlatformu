import { z } from 'zod';

import { taskDetailSchema } from './complete-task.schema.js';

export const delegateTaskBodySchema = z.object({
  delegateToUserId: z.string().min(1),
  reason: z.string().min(1).max(2000),
});

export type DelegateTaskBody = z.infer<typeof delegateTaskBodySchema>;

export const delegateTaskResponseSchema = z.object({
  data: taskDetailSchema,
});

export type DelegateTaskResponse = z.infer<typeof delegateTaskResponseSchema>;
