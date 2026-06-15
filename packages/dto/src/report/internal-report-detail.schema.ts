import { CLEARANCE_LEVEL_VALUES, REPORT_STATUS_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const internalReportDetailSchema = z.object({
  id: z.string(),
  trackingCodeMasked: z.string(),
  status: z.enum(REPORT_STATUS_VALUES as [string, ...string[]]),
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  companyId: z.string(),
  companyName: z.string(),
  categoryGroup: z.string(),
  categoryGroupLabel: z.string(),
  categories: z.array(z.string()),
  isAnonymous: z.boolean(),
  urgentRiskFlag: z.boolean(),
  submittedAt: z.string().datetime(),
  incidentCountry: z.string(),
  incidentCity: z.string(),
  incidentLocationDetail: z.string().nullable().optional(),
  incidentDateStart: z.string().nullable().optional(),
  incidentDescription: z.string().optional(),
  reporterIdentityName: z.string().nullable().optional(),
  reporterIdentityTitle: z.string().nullable().optional(),
  reporterIdentityRelation: z.string().nullable().optional(),
  reporterContactEmail: z.string().nullable().optional(),
  reporterContactPhone: z.string().nullable().optional(),
  urgentRiskDescription: z.string().nullable().optional(),
  involvedPersons: z.unknown().optional(),
  witnesses: z.unknown().optional(),
  categorySpecificData: z.unknown().optional(),
  attachmentCount: z.number().int().nonnegative(),
});

export type InternalReportDetail = z.infer<typeof internalReportDetailSchema>;
