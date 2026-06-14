import { z } from 'zod';

import { MALWARE_SCAN_STATUS_VALUES } from '@ethics/shared';

const malwareScanStatusSchema = z.enum(MALWARE_SCAN_STATUS_VALUES as [string, ...string[]]);

export const listAdminDocumentOperationsQuerySchema = z.object({
  scanStatus: malwareScanStatusSchema.optional(),
  mimeType: z.string().min(1).max(100).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export const adminDocumentOperationItemSchema = z.object({
  documentId: z.string(),
  caseId: z.string(),
  documentCategory: z.string(),
  documentStatus: z.string(),
  sizeBytes: z.number(),
  mimeType: z.string(),
  malwareScanStatus: z.string(),
  contentSha256Prefix: z.string(),
  uploadedAt: z.string(),
  scannedAt: z.string().nullable(),
});

export const adminDocumentOperationsSummarySchema = z.object({
  totalDocuments: z.number(),
  pendingScanCount: z.number(),
  quarantinedCount: z.number(),
  rejectedCount: z.number(),
  cleanCount: z.number(),
});

export const listAdminDocumentOperationsResponseSchema = z.object({
  summary: adminDocumentOperationsSummarySchema,
  items: z.array(adminDocumentOperationItemSchema),
  nextCursor: z.string().nullable(),
});

export type ListAdminDocumentOperationsQuery = z.infer<
  typeof listAdminDocumentOperationsQuerySchema
>;
export type AdminDocumentOperationItem = z.infer<typeof adminDocumentOperationItemSchema>;
export type AdminDocumentOperationsSummary = z.infer<typeof adminDocumentOperationsSummarySchema>;
export type ListAdminDocumentOperationsResponse = z.infer<
  typeof listAdminDocumentOperationsResponseSchema
>;
