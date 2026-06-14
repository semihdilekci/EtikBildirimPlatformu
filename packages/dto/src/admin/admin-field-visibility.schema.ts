import { ROLE_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const CASE_FIELD_NAMES = [
  'case_metadata',
  'report_text',
  'reporter_identity',
  'reporter_contact',
  'incident_date',
  'incident_location',
  'involved_persons',
  'witnesses',
  'attachments',
  'pre_research_notes',
  'rapporteur_report',
  'council_decision_draft',
  'council_decision_final',
  'action_letter',
  'action_response',
  'secure_messages',
] as const;

export const fieldVisibilityLevelSchema = z.enum([
  'visible',
  'own_only',
  'metadata_only',
  'hidden',
]);

export type FieldVisibilityLevel = z.infer<typeof fieldVisibilityLevelSchema>;

export const fieldVisibilityChangeSchema = z.object({
  roleCode: z.enum(ROLE_VALUES as [string, ...string[]]),
  fieldName: z.enum(CASE_FIELD_NAMES),
  visibility: fieldVisibilityLevelSchema,
});

export const updateFieldVisibilityBodySchema = z.object({
  changes: z.array(fieldVisibilityChangeSchema).min(1).max(100),
  reason: z.string().trim().min(3).max(500),
});

export type UpdateFieldVisibilityBody = z.infer<typeof updateFieldVisibilityBodySchema>;

export const approveFieldVisibilityBatchBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveFieldVisibilityBatchBody = z.infer<typeof approveFieldVisibilityBatchBodySchema>;

export const fieldVisibilityMatrixItemSchema = z.object({
  roleCode: z.string(),
  fieldName: z.string(),
  visibility: fieldVisibilityLevelSchema,
  pendingBatchId: z.string().nullable(),
});

export type FieldVisibilityMatrixItem = z.infer<typeof fieldVisibilityMatrixItemSchema>;

export const fieldVisibilityMatrixResponseSchema = z.object({
  roles: z.array(z.string()),
  fields: z.array(z.string()),
  matrix: z.array(fieldVisibilityMatrixItemSchema),
});

export type FieldVisibilityMatrixResponse = z.infer<typeof fieldVisibilityMatrixResponseSchema>;

export const fieldVisibilityChangeProposalSchema = z.object({
  batchId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  items: z.array(
    z.object({
      roleCode: z.string(),
      fieldName: z.string(),
      currentVisibility: fieldVisibilityLevelSchema,
      proposedVisibility: fieldVisibilityLevelSchema,
    }),
  ),
});

export type FieldVisibilityChangeProposal = z.infer<typeof fieldVisibilityChangeProposalSchema>;

export const approveFieldVisibilityBatchResponseSchema = z.object({
  batchId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  appliedChanges: z.array(
    z.object({
      roleCode: z.string(),
      fieldName: z.string(),
    }),
  ),
});

export type ApproveFieldVisibilityBatchResponse = z.infer<
  typeof approveFieldVisibilityBatchResponseSchema
>;
