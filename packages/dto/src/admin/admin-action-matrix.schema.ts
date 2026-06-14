import { ADMIN_ACTION_CODE_VALUES, ROLE_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const updateActionMatrixBodySchema = z.object({
  makerRole: z.enum(ROLE_VALUES as [string, ...string[]]),
  checkerRole: z.enum(ROLE_VALUES as [string, ...string[]]),
  reason: z.string().trim().min(3).max(500),
});

export type UpdateActionMatrixBody = z.infer<typeof updateActionMatrixBodySchema>;

export const approveActionMatrixBatchBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveActionMatrixBatchBody = z.infer<typeof approveActionMatrixBatchBodySchema>;

export const actionMatrixListItemSchema = z.object({
  actionCode: z.string(),
  makerRole: z.string(),
  checkerRole: z.string(),
  updatedAt: z.string().datetime(),
  pendingBatchId: z.string().nullable(),
});

export type ActionMatrixListItem = z.infer<typeof actionMatrixListItemSchema>;

export const actionMatrixChangeProposalSchema = z.object({
  batchId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  items: z.array(
    z.object({
      actionCode: z.string(),
      currentMakerRole: z.string(),
      proposedMakerRole: z.string(),
      currentCheckerRole: z.string(),
      proposedCheckerRole: z.string(),
    }),
  ),
});

export type ActionMatrixChangeProposal = z.infer<typeof actionMatrixChangeProposalSchema>;

export const approveActionMatrixBatchResponseSchema = z.object({
  batchId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  appliedActionCodes: z.array(z.string()),
});

export type ApproveActionMatrixBatchResponse = z.infer<
  typeof approveActionMatrixBatchResponseSchema
>;

export const actionMatrixActionIdParamSchema = z.enum(
  ADMIN_ACTION_CODE_VALUES as [string, ...string[]],
);

export type ActionMatrixActionIdParam = z.infer<typeof actionMatrixActionIdParamSchema>;
