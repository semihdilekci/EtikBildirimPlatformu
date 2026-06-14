import { z } from 'zod';

export const createKvkkTextBodySchema = z.object({
  versionCode: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^\d+\.\d+$/, 'Versiyon formatı X.Y olmalıdır (ör. 1.1).'),
  contentText: z.string().trim().min(20).max(50_000),
  effectiveDate: z.string().date(),
  reason: z.string().trim().min(3).max(500),
});

export type CreateKvkkTextBody = z.infer<typeof createKvkkTextBodySchema>;

export const approveKvkkTextBatchBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveKvkkTextBatchBody = z.infer<typeof approveKvkkTextBatchBodySchema>;

export const kvkkTextListItemSchema = z.object({
  id: z.string(),
  versionCode: z.string(),
  contentText: z.string(),
  effectiveDate: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DRAFT', 'PENDING']),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pendingBatchId: z.string().nullable(),
});

export type KvkkTextListItem = z.infer<typeof kvkkTextListItemSchema>;

export const kvkkTextChangeProposalSchema = z.object({
  batchId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  item: z.object({
    versionCode: z.string(),
    contentText: z.string(),
    effectiveDate: z.string().date(),
  }),
});

export type KvkkTextChangeProposal = z.infer<typeof kvkkTextChangeProposalSchema>;

export const approveKvkkTextBatchResponseSchema = z.object({
  batchId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  publishedVersionCode: z.string().nullable(),
});

export type ApproveKvkkTextBatchResponse = z.infer<typeof approveKvkkTextBatchResponseSchema>;
