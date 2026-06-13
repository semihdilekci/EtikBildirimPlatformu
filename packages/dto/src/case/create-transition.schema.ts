import { CASE_STATE_VALUES, WORKFLOW_COMMAND_VALUES, WorkflowCommand } from '@ethics/shared';
import { z } from 'zod';

const transitionCommandValues = WORKFLOW_COMMAND_VALUES.filter(
  (command) => command !== WorkflowCommand.OPEN_CASE,
) as [string, ...string[]];

export const createTransitionBodySchema = z.object({
  command: z.enum(transitionCommandValues),
  reason: z.string().max(2000).optional(),
  idempotencyKey: z.string().uuid('Idempotency key UUID v4 formatında olmalıdır.'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateTransitionBody = z.infer<typeof createTransitionBodySchema>;

export const transitionTaskStubSchema = z.object({
  id: z.string(),
  taskType: z.string(),
  assignedRole: z.string(),
});

export type TransitionTaskStub = z.infer<typeof transitionTaskStubSchema>;

export const createTransitionResponseSchema = z.object({
  caseId: z.string(),
  transitionId: z.string(),
  fromState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  toState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  command: z.enum(transitionCommandValues),
  transitionedAt: z.string().datetime(),
  tasksCreated: z.array(transitionTaskStubSchema),
  idempotentReplay: z.boolean(),
});

export type CreateTransitionResponse = z.infer<typeof createTransitionResponseSchema>;
