import {
  categorySpecificDataSchemas,
  createReportBodySchema,
  type CreateReportBody,
} from '@ethics/dto';
import {
  HowReporterLearned,
  IncidentRecurrence,
  REPORT_CATEGORY_GROUP_VALUES,
  REPORT_SUB_CATEGORY_VALUES,
  ReportCategoryGroup,
  ReportSubCategory,
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

const involvedPersonFormSchema = z.object({
  name: z.string().min(1, 'Ad/tanım zorunludur.').max(200),
  title: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  companyName: z.string().max(200).optional(),
  isSeniorManagement: z.boolean().optional(),
});

const witnessFormSchema = z.object({
  name: z.string().min(1, 'Ad/tanım zorunludur.').max(200),
  contact: z.string().max(200).optional(),
});

/** UI-only alanlar + API payload alanları */
export const reportFormSchema = z
  .object({
    kvkkConsent: z.boolean(),
    kvkkConsentVersion: z.string().min(1),
    reporterCountry: isoCountryCodeSchema,
    reporterCity: z.string().min(1, 'Şehir zorunludur.').max(100),
    companyId: z.string().min(1, 'Şirket seçimi zorunludur.'),
    incidentCountry: isoCountryCodeSchema,
    incidentCity: z.string().min(1, 'Olay yeri şehri zorunludur.').max(100),
    incidentLocationDetail: z.string().max(500).optional().nullable(),
    categoryGroup: z.enum(REPORT_CATEGORY_GROUP_VALUES as [string, ...string[]]),
    categories: z.array(z.enum(REPORT_SUB_CATEGORY_VALUES as [string, ...string[]])),
    isUncertainCategory: z.boolean(),
    incidentDescription: z
      .string()
      .min(50, 'Olay açıklaması en az 50 karakter olmalıdır.')
      .max(10_000),
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
    incidentIsOngoing: z.boolean(),
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
    previouslyReported: z.boolean(),
    previouslyReportedTo: z.string().max(500).optional().nullable(),
    urgentRiskFlag: z.boolean(),
    urgentRiskDescription: z.string().max(2000).optional().nullable(),
    involvedPersons: z.array(involvedPersonFormSchema).max(20),
    witnesses: z.array(witnessFormSchema).max(10),
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
    reporterContactEmail: z
      .string()
      .max(320)
      .refine((value) => value === '' || z.string().email().safeParse(value).success, {
        message: 'Geçerli bir e-posta adresi giriniz.',
      })
      .optional()
      .nullable(),
    reporterContactPhone: z.string().max(30).optional().nullable(),
    trackingPassword: trackingPasswordSchema,
    trackingPasswordConfirm: z.string().min(1, 'Parola tekrarı zorunludur.'),
  })
  .superRefine((data, ctx) => {
    if (!data.kvkkConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'KVKK metnini okuduğunuzu onaylamanız gerekir.',
        path: ['kvkkConsent'],
      });
    }

    if (data.categories.length === 0 && !data.isUncertainCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'En az bir kategori seçilmelidir.',
        path: ['categories'],
      });
    }

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

    if (data.trackingPassword !== data.trackingPasswordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parolalar eşleşmiyor.',
        path: ['trackingPasswordConfirm'],
      });
    }

    if (data.categoryGroup === ReportCategoryGroup.EXTERNAL_ENVIRONMENT) {
      return;
    }

    for (const category of data.categories) {
      if (!(category in categorySpecificDataSchemas)) {
        continue;
      }

      const schema =
        categorySpecificDataSchemas[category as keyof typeof categorySpecificDataSchemas];
      const parsed = schema.safeParse(data.categorySpecificData ?? {});
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kategori bazlı alan doğrulaması başarısız.',
          path: ['categorySpecificData'],
        });
      }
    }
  });

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const reportFormDefaultValues: ReportFormValues = {
  kvkkConsent: false,
  kvkkConsentVersion: '',
  reporterCountry: 'TUR',
  reporterCity: '',
  companyId: '',
  incidentCountry: 'TUR',
  incidentCity: '',
  incidentLocationDetail: null,
  categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
  categories: [],
  isUncertainCategory: false,
  incidentDescription: '',
  incidentDateStart: null,
  incidentDateEnd: null,
  incidentIsOngoing: false,
  incidentRecurrence: null,
  howReporterLearned: null,
  previouslyReported: false,
  previouslyReportedTo: null,
  urgentRiskFlag: false,
  urgentRiskDescription: null,
  involvedPersons: [],
  witnesses: [],
  categorySpecificData: {},
  isAnonymous: true,
  reporterIdentityName: null,
  reporterIdentityTitle: null,
  reporterIdentityRelation: null,
  reporterContactEmail: '',
  reporterContactPhone: null,
  trackingPassword: '',
  trackingPasswordConfirm: '',
};

/** Adım bazlı doğrulama alanları */
export const REPORT_STEP_FIELDS: readonly (readonly (keyof ReportFormValues)[])[] = [
  ['kvkkConsent', 'kvkkConsentVersion'],
  ['reporterCountry', 'reporterCity'],
  ['companyId', 'incidentCountry', 'incidentCity', 'incidentLocationDetail'],
  ['categoryGroup', 'categories', 'isUncertainCategory'],
  [
    'incidentDescription',
    'incidentDateStart',
    'incidentDateEnd',
    'incidentIsOngoing',
    'incidentRecurrence',
    'howReporterLearned',
    'involvedPersons',
    'witnesses',
    'previouslyReported',
    'previouslyReportedTo',
    'urgentRiskFlag',
    'urgentRiskDescription',
  ],
  ['categorySpecificData'],
  [],
  [
    'isAnonymous',
    'reporterIdentityName',
    'reporterIdentityTitle',
    'reporterIdentityRelation',
    'reporterContactEmail',
    'reporterContactPhone',
  ],
  ['trackingPassword', 'trackingPasswordConfirm'],
  [],
] as const;

export function mapReportFormToApiBody(values: ReportFormValues): CreateReportBody {
  const categories =
    values.isUncertainCategory && values.categories.length === 0
      ? [ReportSubCategory.GENERAL_ETHICS_VIOLATION]
      : values.categories;

  const payload = {
    reporterCountry: values.reporterCountry,
    reporterCity: values.reporterCity,
    companyId: values.companyId,
    incidentCountry: values.incidentCountry,
    incidentCity: values.incidentCity,
    incidentLocationDetail: values.incidentLocationDetail ?? null,
    categoryGroup: values.categoryGroup,
    categories,
    isUncertainCategory: values.isUncertainCategory,
    incidentDescription: values.incidentDescription,
    incidentDateStart: values.incidentDateStart ?? null,
    incidentDateEnd: values.incidentDateEnd ?? null,
    incidentIsOngoing: values.incidentIsOngoing,
    incidentRecurrence: values.incidentRecurrence ?? null,
    howReporterLearned: values.howReporterLearned ?? null,
    previouslyReported: values.previouslyReported,
    previouslyReportedTo: values.previouslyReportedTo ?? null,
    urgentRiskFlag: values.urgentRiskFlag,
    urgentRiskDescription: values.urgentRiskDescription ?? null,
    involvedPersons: values.involvedPersons,
    witnesses: values.witnesses,
    categorySpecificData: values.categorySpecificData ?? null,
    isAnonymous: values.isAnonymous,
    reporterIdentityName: values.isAnonymous ? null : (values.reporterIdentityName ?? null),
    reporterIdentityTitle: values.isAnonymous ? null : (values.reporterIdentityTitle ?? null),
    reporterIdentityRelation: values.isAnonymous ? null : (values.reporterIdentityRelation ?? null),
    reporterContactEmail: values.isAnonymous
      ? null
      : values.reporterContactEmail?.trim()
        ? values.reporterContactEmail.trim()
        : null,
    reporterContactPhone: values.isAnonymous ? null : (values.reporterContactPhone ?? null),
    trackingPassword: values.trackingPassword,
    kvkkConsentVersion: values.kvkkConsentVersion,
  };

  return createReportBodySchema.parse(payload);
}

export function hasDynamicCategoryStep(categories: readonly string[]): boolean {
  return categories.some((category) => category in categorySpecificDataSchemas);
}
