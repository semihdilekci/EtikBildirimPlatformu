import { ROLE_VALUES, SLA_UNIT_VALUES, TASK_TYPE_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const slaPolicyConfigSnapshotSchema = z.object({
  slaDuration: z.number().int().positive(),
  slaUnit: z.enum(SLA_UNIT_VALUES as [string, ...string[]]),
  warningThresholdHours: z.number().int().positive(),
  dailyOverdueNotification: z.boolean(),
  escalationRole: z.enum(ROLE_VALUES as [string, ...string[]]),
});

export type SlaPolicyConfigSnapshot = z.infer<typeof slaPolicyConfigSnapshotSchema>;

export const updateSlaPolicyBodySchema = z
  .object({
    slaDuration: z.number().int().positive().optional(),
    slaUnit: z.enum(SLA_UNIT_VALUES as [string, ...string[]]).optional(),
    warningThresholdHours: z.number().int().positive().optional(),
    dailyOverdueNotification: z.boolean().optional(),
    escalationRole: z.enum(ROLE_VALUES as [string, ...string[]]).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .refine(
    (body) =>
      body.slaDuration !== undefined ||
      body.slaUnit !== undefined ||
      body.warningThresholdHours !== undefined ||
      body.dailyOverdueNotification !== undefined ||
      body.escalationRole !== undefined,
    { message: 'En az bir SLA alanı güncellenmelidir.' },
  );

export type UpdateSlaPolicyBody = z.infer<typeof updateSlaPolicyBodySchema>;

export const slaPolicyTaskTypeParamSchema = z.enum(TASK_TYPE_VALUES as [string, ...string[]]);

export type SlaPolicyTaskTypeParam = z.infer<typeof slaPolicyTaskTypeParamSchema>;

export const approveSlaPolicyBatchBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveSlaPolicyBatchBody = z.infer<typeof approveSlaPolicyBatchBodySchema>;

export const slaPolicyListItemSchema = z.object({
  taskType: z.enum(TASK_TYPE_VALUES as [string, ...string[]]),
  slaDuration: z.number().int().positive(),
  slaUnit: z.enum(SLA_UNIT_VALUES as [string, ...string[]]),
  warningThresholdHours: z.number().int().positive(),
  dailyOverdueNotification: z.boolean(),
  escalationRole: z.enum(ROLE_VALUES as [string, ...string[]]),
  updatedAt: z.string().datetime(),
  pendingBatchId: z.string().nullable(),
});

export type SlaPolicyListItem = z.infer<typeof slaPolicyListItemSchema>;

export const slaPolicyChangeProposalSchema = z.object({
  batchId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  items: z.array(
    z.object({
      taskType: z.enum(TASK_TYPE_VALUES as [string, ...string[]]),
      currentConfig: slaPolicyConfigSnapshotSchema,
      proposedConfig: slaPolicyConfigSnapshotSchema,
    }),
  ),
});

export type SlaPolicyChangeProposal = z.infer<typeof slaPolicyChangeProposalSchema>;

export const approveSlaPolicyBatchResponseSchema = z.object({
  batchId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  appliedTaskTypes: z.array(z.enum(TASK_TYPE_VALUES as [string, ...string[]])),
});

export type ApproveSlaPolicyBatchResponse = z.infer<typeof approveSlaPolicyBatchResponseSchema>;
