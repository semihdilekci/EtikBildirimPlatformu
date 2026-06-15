import { CLEARANCE_LEVEL_VALUES, REPORT_STATUS_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const pendingReportListItemSchema = z.object({
  id: z.string(),
  trackingCodeMasked: z.string(),
  status: z.enum(REPORT_STATUS_VALUES as [string, ...string[]]),
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  companyId: z.string(),
  companyName: z.string(),
  categoryGroup: z.string(),
  categoryGroupLabel: z.string(),
  categories: z.array(z.string()),
  urgentRiskFlag: z.boolean(),
  submittedAt: z.string().datetime(),
  incidentCountry: z.string(),
  incidentCity: z.string(),
});

export type PendingReportListItem = z.infer<typeof pendingReportListItemSchema>;
