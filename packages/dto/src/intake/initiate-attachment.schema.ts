import { z } from 'zod';

import { MAX_SINGLE_FILE_BYTES } from '@ethics/shared';

export const initiateAttachmentBodySchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_SINGLE_FILE_BYTES),
  contentSha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, 'contentSha256 must be a 64-character hex SHA-256 digest'),
  description: z.string().trim().max(500).optional(),
});

export type InitiateAttachmentBody = z.infer<typeof initiateAttachmentBodySchema>;

export const initiateAttachmentResponseSchema = z.object({
  id: z.string(),
  originalFilename: z.string(),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  malwareScanStatus: z.enum(['PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED']),
  uploadUrl: z.string().url(),
  uploadUrlExpiresAt: z.string(),
  uploadedAt: z.string(),
});

export type InitiateAttachmentResponse = z.infer<typeof initiateAttachmentResponseSchema>;
