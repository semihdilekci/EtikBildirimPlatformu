export const ReportStatus = {
  SUBMITTED: 'SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CLOSED: 'CLOSED',
} as const;

export type ReportStatusCode = (typeof ReportStatus)[keyof typeof ReportStatus];

export const REPORT_STATUS_VALUES = Object.values(ReportStatus);

export const REPORT_STATUS_LABELS: Record<ReportStatusCode, string> = {
  [ReportStatus.SUBMITTED]: 'Alındı',
  [ReportStatus.ACKNOWLEDGED]: 'Kayıt altına alındı',
  [ReportStatus.UNDER_REVIEW]: 'İnceleniyor',
  [ReportStatus.CLOSED]: 'Kapatıldı',
};

export const ReportChannel = {
  WEB_FORM: 'WEB_FORM',
  EMAIL_FORWARD: 'EMAIL_FORWARD',
  MANUAL: 'MANUAL',
} as const;

export type ReportChannelCode = (typeof ReportChannel)[keyof typeof ReportChannel];

export const IncidentRecurrence = {
  SINGLE: 'SINGLE',
  RECURRING: 'RECURRING',
  UNKNOWN: 'UNKNOWN',
} as const;

export type IncidentRecurrenceCode = (typeof IncidentRecurrence)[keyof typeof IncidentRecurrence];

export const HowReporterLearned = {
  WITNESSED: 'WITNESSED',
  VICTIM: 'VICTIM',
  TOLD_BY_OTHERS: 'TOLD_BY_OTHERS',
  DOCUMENT: 'DOCUMENT',
  OTHER: 'OTHER',
} as const;

export type HowReporterLearnedCode = (typeof HowReporterLearned)[keyof typeof HowReporterLearned];

export const ReporterIdentityRelation = {
  EMPLOYEE: 'EMPLOYEE',
  FORMER_EMPLOYEE: 'FORMER_EMPLOYEE',
  SUPPLIER: 'SUPPLIER',
  CUSTOMER: 'CUSTOMER',
  BUSINESS_PARTNER: 'BUSINESS_PARTNER',
  CITIZEN: 'CITIZEN',
  OTHER: 'OTHER',
} as const;

export type ReporterIdentityRelationCode =
  (typeof ReporterIdentityRelation)[keyof typeof ReporterIdentityRelation];
