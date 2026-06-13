import {
  HowReporterLearned,
  IncidentRecurrence,
  REPORT_CATEGORY_GROUP_VALUES,
  REPORT_SUB_CATEGORY_VALUES,
  ReportCategoryGroup,
  ReporterIdentityRelation,
} from '@ethics/shared';
import { z } from 'zod';

const isoCountryCodeSchema = z
  .string()
  .length(3, 'Ülke kodu ISO 3166-1 alpha-3 formatında olmalıdır.');

const trackingPasswordSchema = z
  .string()
  .min(8, 'Takip parolası en az 8 karakter olmalıdır.')
  .max(128)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Takip parolası en az bir harf ve bir rakam içermelidir.',
  });

export const involvedPersonSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  companyName: z.string().max(200).optional(),
  isSeniorManagement: z.boolean().optional(),
});

export const witnessSchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().max(200).optional(),
});

/** Kategori bazlı dinamik alan — EMBEZZLEMENT örneği (Docs/03 §8.1) */
export const embezzlementCategoryDataSchema = z.object({
  estimatedAmount: z.string().max(100).optional(),
  currency: z.string().max(3).optional(),
  discoveryMethod: z.string().max(100).optional(),
});

export const categorySpecificDataSchemas = {
  EMBEZZLEMENT: embezzlementCategoryDataSchema,
} as const;

export type CategorySpecificDataSchemas = typeof categorySpecificDataSchemas;

export const createReportBodySchema = z
  .object({
    reporterCountry: isoCountryCodeSchema.optional(),
    reporterCity: z.string().min(1).max(100).optional(),
    companyId: z.string().min(1),
    incidentCountry: isoCountryCodeSchema,
    incidentCity: z.string().min(1).max(100),
    incidentLocationDetail: z.string().max(500).optional().nullable(),
    categoryGroup: z.enum(REPORT_CATEGORY_GROUP_VALUES as [string, ...string[]]),
    categories: z
      .array(z.enum(REPORT_SUB_CATEGORY_VALUES as [string, ...string[]]))
      .min(1, 'En az bir kategori seçilmelidir.'),
    isUncertainCategory: z.boolean().default(false),
    incidentDescription: z.string().min(10).max(10_000),
    incidentDateStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    incidentDateEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    incidentIsOngoing: z.boolean().default(false),
    incidentRecurrence: z
      .enum([IncidentRecurrence.SINGLE, IncidentRecurrence.RECURRING, IncidentRecurrence.UNKNOWN])
      .optional()
      .nullable(),
    howReporterLearned: z
      .enum([
        HowReporterLearned.WITNESSED,
        HowReporterLearned.VICTIM,
        HowReporterLearned.TOLD_BY_OTHERS,
        HowReporterLearned.DOCUMENT,
        HowReporterLearned.OTHER,
      ])
      .optional()
      .nullable(),
    previouslyReported: z.boolean().default(false),
    previouslyReportedTo: z.string().max(500).optional().nullable(),
    urgentRiskFlag: z.boolean().default(false),
    urgentRiskDescription: z.string().max(2000).optional().nullable(),
    involvedPersons: z.array(involvedPersonSchema).max(20).optional().default([]),
    witnesses: z.array(witnessSchema).max(10).optional().default([]),
    categorySpecificData: z.record(z.unknown()).optional().nullable(),
    isAnonymous: z.boolean(),
    reporterIdentityName: z.string().max(200).optional().nullable(),
    reporterIdentityTitle: z.string().max(200).optional().nullable(),
    reporterIdentityRelation: z
      .enum([
        ReporterIdentityRelation.EMPLOYEE,
        ReporterIdentityRelation.FORMER_EMPLOYEE,
        ReporterIdentityRelation.SUPPLIER,
        ReporterIdentityRelation.CUSTOMER,
        ReporterIdentityRelation.BUSINESS_PARTNER,
        ReporterIdentityRelation.CITIZEN,
        ReporterIdentityRelation.OTHER,
      ])
      .optional()
      .nullable(),
    reporterContactEmail: z.string().email().max(320).optional().nullable(),
    reporterContactPhone: z.string().max(30).optional().nullable(),
    trackingPassword: trackingPasswordSchema,
    kvkkConsentVersion: z.string().min(1).max(20),
  })
  .superRefine((data, ctx) => {
    if (data.urgentRiskFlag && !data.urgentRiskDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Acil risk açıklaması zorunludur.',
        path: ['urgentRiskDescription'],
      });
    }

    if (data.previouslyReported && !data.previouslyReportedTo?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Önceki bildirim yeri zorunludur.',
        path: ['previouslyReportedTo'],
      });
    }

    if (data.categoryGroup === ReportCategoryGroup.EXTERNAL_ENVIRONMENT) {
      return;
    }

    for (const category of data.categories) {
      if (!(category in categorySpecificDataSchemas) || !data.categorySpecificData) {
        continue;
      }
      const schema = categorySpecificDataSchemas[category as keyof CategorySpecificDataSchemas];
      const parsed = schema.safeParse(data.categorySpecificData);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kategori bazlı alan doğrulaması başarısız.',
          path: ['categorySpecificData'],
        });
      }
    }
  });

export type CreateReportBody = z.infer<typeof createReportBodySchema>;

export const createReportResponseSchema = z.object({
  trackingCode: z.string(),
  submittedAt: z.string().datetime(),
  message: z.string(),
});

export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;

export const intakeCompanyListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

export type IntakeCompanyListItem = z.infer<typeof intakeCompanyListItemSchema>;

export const intakeKvkkTextResponseSchema = z.object({
  version: z.string(),
  effectiveDate: z.string().datetime(),
  bodyHtml: z.string(),
  privacyNoticeHtml: z.string(),
});

export type IntakeKvkkTextResponse = z.infer<typeof intakeKvkkTextResponseSchema>;
