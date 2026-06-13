import { CASE_STATE_VALUES, WORKFLOW_COMMAND_VALUES } from '@ethics/shared';
import { z } from 'zod';

const transitionCommandValues = WORKFLOW_COMMAND_VALUES.filter(
  (command) => command !== 'open_case',
) as [string, ...string[]];

export const caseTransitionItemSchema = z.object({
  id: z.string(),
  fromState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  toState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  fromStateLabel: z.string(),
  toStateLabel: z.string(),
  command: z.enum(transitionCommandValues),
  commandLabel: z.string(),
  actorType: z.string(),
  actorDisplayName: z.string().nullable(),
  transitionedAt: z.string().datetime(),
  reason: z.string().optional(),
});

export type CaseTransitionItem = z.infer<typeof caseTransitionItemSchema>;

export const caseTransitionListResponseSchema = z.object({
  data: z.array(caseTransitionItemSchema),
});

export type CaseTransitionListResponse = z.infer<typeof caseTransitionListResponseSchema>;
