import { z } from 'zod';

export const completeCaseDocumentUploadResponseSchema = z.object({
  id: z.string(),
  versionNo: z.number().int().positive(),
  contentSealedAt: z.string(),
});

export type CompleteCaseDocumentUploadResponse = z.infer<
  typeof completeCaseDocumentUploadResponseSchema
>;

export const documentDownloadResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.string(),
  filename: z.string(),
});

export type DocumentDownloadResponse = z.infer<typeof documentDownloadResponseSchema>;
