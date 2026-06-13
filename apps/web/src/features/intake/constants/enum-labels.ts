import {
  HowReporterLearned,
  IncidentRecurrence,
  ReporterIdentityRelation,
  ReportSubCategory,
} from '@ethics/shared';

export const INCIDENT_RECURRENCE_LABELS: Record<string, string> = {
  [IncidentRecurrence.SINGLE]: 'Tek seferlik',
  [IncidentRecurrence.RECURRING]: 'Tekrarlayan',
  [IncidentRecurrence.UNKNOWN]: 'Bilmiyorum',
};

export const HOW_REPORTER_LEARNED_LABELS: Record<string, string> = {
  [HowReporterLearned.WITNESSED]: 'Olaya tanık oldum',
  [HowReporterLearned.VICTIM]: 'Mağdur oldum',
  [HowReporterLearned.TOLD_BY_OTHERS]: 'Başkalarından duydum',
  [HowReporterLearned.DOCUMENT]: 'Belge/kanıt gördüm',
  [HowReporterLearned.OTHER]: 'Diğer',
};

export const REPORTER_IDENTITY_RELATION_LABELS: Record<string, string> = {
  [ReporterIdentityRelation.EMPLOYEE]: 'Çalışan',
  [ReporterIdentityRelation.FORMER_EMPLOYEE]: 'Eski çalışan',
  [ReporterIdentityRelation.SUPPLIER]: 'Tedarikçi',
  [ReporterIdentityRelation.CUSTOMER]: 'Müşteri',
  [ReporterIdentityRelation.BUSINESS_PARTNER]: 'İş ortağı',
  [ReporterIdentityRelation.CITIZEN]: 'Vatandaş',
  [ReporterIdentityRelation.OTHER]: 'Diğer',
};

export const SENSITIVE_CATEGORIES = new Set<string>([
  ReportSubCategory.HARASSMENT,
  ReportSubCategory.DISCRIMINATION,
  ReportSubCategory.HUMAN_RIGHTS_VIOLATION,
]);

export const REPORT_FORM_STEP_LABELS = [
  'Giriş & KVKK',
  'Konum',
  'Şirket & Olay Yeri',
  'Kategori',
  'Olay Bilgileri',
  'Ek Sorular',
  'Kanıt/Dosya',
  'Kimlik Tercihi',
  'Takip Şifresi',
  'Gönderim Özeti',
] as const;
