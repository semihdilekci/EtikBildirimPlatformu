import { z } from 'zod';

import {
  DOCUMENT_CATEGORY_VALUES,
  DOCUMENT_STATUS_VALUES,
  MALWARE_SCAN_STATUS_VALUES,
} from '@ethics/shared';

export const caseDocumentListItemSchema = z.object({
  id: z.string(),
  documentCategory: z.enum(DOCUMENT_CATEGORY_VALUES as [string, ...string[]]),
  title: z.string(),
  currentVersionNo: z.number().int().positive(),
  status: z.enum(DOCUMENT_STATUS_VALUES as [string, ...string[]]),
  malwareScanStatus: z.enum(MALWARE_SCAN_STATUS_VALUES as [string, ...string[]]),
  confidentialityLevel: z.string(),
  uploadedAt: z.string(),
  uploadedByDisplayName: z.string().nullable(),
  canDownload: z.boolean(),
});

export type CaseDocumentListItem = z.infer<typeof caseDocumentListItemSchema>;

export const listCaseDocumentsResponseSchema = z.object({
  data: z.array(caseDocumentListItemSchema),
});

export type ListCaseDocumentsResponse = z.infer<typeof listCaseDocumentsResponseSchema>;
