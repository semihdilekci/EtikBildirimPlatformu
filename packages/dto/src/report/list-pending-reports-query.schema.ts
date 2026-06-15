import { z } from 'zod';

import { pendingReportListItemSchema } from './pending-report-list-item.schema.js';

const pendingReportSortByValues = ['submittedAt', 'urgentRiskFlag'] as const;

export const listPendingReportsQuerySchema = z.object({
  companyId: z.string().min(1).optional(),
  urgentRiskOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      return value === 'true';
    }),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().min(1).optional(),
  sortBy: z.enum(pendingReportSortByValues).optional().default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListPendingReportsQuery = z.infer<typeof listPendingReportsQuerySchema>;

export const pendingReportPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.null(),
});

export type PendingReportPagination = z.infer<typeof pendingReportPaginationSchema>;

export const listPendingReportsResponseSchema = z.object({
  data: z.array(pendingReportListItemSchema),
  pagination: pendingReportPaginationSchema,
});

export type ListPendingReportsResponse = z.infer<typeof listPendingReportsResponseSchema>;
