import { z } from 'zod';

import { DOCUMENT_CATEGORY_VALUES, MalwareScanStatus, MAX_SINGLE_FILE_BYTES } from '@ethics/shared';

export const initiateCaseDocumentBodySchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_SINGLE_FILE_BYTES),
  contentSha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, 'contentSha256 must be a 64-character hex SHA-256 digest'),
  documentCategory: z.enum(DOCUMENT_CATEGORY_VALUES as [string, ...string[]]),
  title: z.string().trim().min(1).max(255),
  taskId: z.string().trim().min(1).optional(),
});

export type InitiateCaseDocumentBody = z.infer<typeof initiateCaseDocumentBodySchema>;

export const initiateCaseDocumentResponseSchema = z.object({
  id: z.string(),
  versionNo: z.number().int().positive(),
  status: z.enum(['UPLOADED', 'QUARANTINED', 'AVAILABLE', 'REJECTED']),
  malwareScanStatus: z.enum([
    MalwareScanStatus.PENDING,
    MalwareScanStatus.CLEAN,
    MalwareScanStatus.QUARANTINED,
    MalwareScanStatus.REJECTED,
  ]),
  uploadUrl: z.string().url(),
  uploadUrlExpiresAt: z.string(),
  uploadedAt: z.string(),
});

export type InitiateCaseDocumentResponse = z.infer<typeof initiateCaseDocumentResponseSchema>;
