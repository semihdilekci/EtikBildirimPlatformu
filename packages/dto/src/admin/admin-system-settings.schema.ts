import { z } from 'zod';

export const systemSettingValueSchema = z.union([
  z.string().min(1),
  z.number(),
  z.boolean(),
  z.record(z.unknown()),
  z.array(z.unknown()),
]);

export type SystemSettingValue = z.infer<typeof systemSettingValueSchema>;

export const updateSystemSettingBodySchema = z.object({
  value: systemSettingValueSchema,
  reason: z.string().trim().min(3).max(500),
});

export type UpdateSystemSettingBody = z.infer<typeof updateSystemSettingBodySchema>;

export const bulkSystemSettingChangeSchema = z.object({
  key: z.string().min(1),
  value: systemSettingValueSchema,
});

export const bulkUpdateSystemSettingsBodySchema = z.object({
  changes: z.array(bulkSystemSettingChangeSchema).min(1).max(50),
  reason: z.string().trim().min(3).max(500),
});

export type BulkUpdateSystemSettingsBody = z.infer<typeof bulkUpdateSystemSettingsBodySchema>;

export const approveSystemSettingBatchBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveSystemSettingBatchBody = z.infer<typeof approveSystemSettingBatchBodySchema>;

export const systemSettingListItemSchema = z.object({
  key: z.string(),
  value: systemSettingValueSchema,
  group: z.string(),
  description: z.string(),
  unit: z.string().nullable(),
  valueType: z.enum(['number', 'boolean', 'string', 'json']),
  mutable: z.boolean(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().nullable(),
  pendingBatchId: z.string().nullable(),
});

export type SystemSettingListItem = z.infer<typeof systemSettingListItemSchema>;

export const systemSettingChangeProposalSchema = z.object({
  batchId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  items: z.array(
    z.object({
      key: z.string(),
      currentValue: systemSettingValueSchema,
      proposedValue: systemSettingValueSchema,
    }),
  ),
});

export type SystemSettingChangeProposal = z.infer<typeof systemSettingChangeProposalSchema>;

export const approveSystemSettingBatchResponseSchema = z.object({
  batchId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  appliedKeys: z.array(z.string()),
});

export type ApproveSystemSettingBatchResponse = z.infer<
  typeof approveSystemSettingBatchResponseSchema
>;
