/** Bildirim üst kategori grupları — Docs/01_DOMAIN_MODEL.md */
export const ReportCategoryGroup = {
  EMPLOYEE_HUMAN: 'EMPLOYEE_HUMAN',
  ASSET_FINANCIAL: 'ASSET_FINANCIAL',
  COMPLIANCE_LEGAL: 'COMPLIANCE_LEGAL',
  EXTERNAL_ENVIRONMENT: 'EXTERNAL_ENVIRONMENT',
} as const;

export type ReportCategoryGroupCode =
  (typeof ReportCategoryGroup)[keyof typeof ReportCategoryGroup];

export const REPORT_CATEGORY_GROUP_VALUES = Object.values(ReportCategoryGroup);

/** 18 alt kategori — Docs/06_SCREEN_CATALOG.md */
export const ReportSubCategory = {
  HARASSMENT: 'HARASSMENT',
  DISCRIMINATION: 'DISCRIMINATION',
  WORKPLACE_VIOLENCE: 'WORKPLACE_VIOLENCE',
  HUMAN_RIGHTS_VIOLATION: 'HUMAN_RIGHTS_VIOLATION',
  RETALIATION: 'RETALIATION',
  THEFT: 'THEFT',
  EMBEZZLEMENT: 'EMBEZZLEMENT',
  FRAUD: 'FRAUD',
  MISUSE: 'MISUSE',
  BRIBERY_CORRUPTION_GIFT: 'BRIBERY_CORRUPTION_GIFT',
  CONFLICT_OF_INTEREST: 'CONFLICT_OF_INTEREST',
  INSIDER_TRADING: 'INSIDER_TRADING',
  DATA_PRIVACY_BREACH: 'DATA_PRIVACY_BREACH',
  REGULATORY_VIOLATION: 'REGULATORY_VIOLATION',
  ENVIRONMENTAL_VIOLATION: 'ENVIRONMENTAL_VIOLATION',
  HEALTH_SAFETY_VIOLATION: 'HEALTH_SAFETY_VIOLATION',
  SUPPLIER_MISCONDUCT: 'SUPPLIER_MISCONDUCT',
  GENERAL_ETHICS_VIOLATION: 'GENERAL_ETHICS_VIOLATION',
} as const;

export type ReportSubCategoryCode = (typeof ReportSubCategory)[keyof typeof ReportSubCategory];

export const REPORT_SUB_CATEGORY_VALUES = Object.values(ReportSubCategory);

export interface ReportCategoryCatalogEntry {
  groupCode: ReportCategoryGroupCode;
  groupLabel: string;
  categories: Array<{ code: ReportSubCategoryCode; label: string }>;
}

/** Kategori kodu → üst grup eşlemesi */
export const REPORT_SUB_CATEGORY_TO_GROUP: Record<ReportSubCategoryCode, ReportCategoryGroupCode> =
  {
    [ReportSubCategory.HARASSMENT]: ReportCategoryGroup.EMPLOYEE_HUMAN,
    [ReportSubCategory.DISCRIMINATION]: ReportCategoryGroup.EMPLOYEE_HUMAN,
    [ReportSubCategory.WORKPLACE_VIOLENCE]: ReportCategoryGroup.EMPLOYEE_HUMAN,
    [ReportSubCategory.HUMAN_RIGHTS_VIOLATION]: ReportCategoryGroup.EMPLOYEE_HUMAN,
    [ReportSubCategory.RETALIATION]: ReportCategoryGroup.EMPLOYEE_HUMAN,
    [ReportSubCategory.THEFT]: ReportCategoryGroup.ASSET_FINANCIAL,
    [ReportSubCategory.EMBEZZLEMENT]: ReportCategoryGroup.ASSET_FINANCIAL,
    [ReportSubCategory.FRAUD]: ReportCategoryGroup.ASSET_FINANCIAL,
    [ReportSubCategory.MISUSE]: ReportCategoryGroup.ASSET_FINANCIAL,
    [ReportSubCategory.BRIBERY_CORRUPTION_GIFT]: ReportCategoryGroup.ASSET_FINANCIAL,
    [ReportSubCategory.CONFLICT_OF_INTEREST]: ReportCategoryGroup.COMPLIANCE_LEGAL,
    [ReportSubCategory.INSIDER_TRADING]: ReportCategoryGroup.COMPLIANCE_LEGAL,
    [ReportSubCategory.DATA_PRIVACY_BREACH]: ReportCategoryGroup.COMPLIANCE_LEGAL,
    [ReportSubCategory.REGULATORY_VIOLATION]: ReportCategoryGroup.COMPLIANCE_LEGAL,
    [ReportSubCategory.ENVIRONMENTAL_VIOLATION]: ReportCategoryGroup.EXTERNAL_ENVIRONMENT,
    [ReportSubCategory.HEALTH_SAFETY_VIOLATION]: ReportCategoryGroup.EXTERNAL_ENVIRONMENT,
    [ReportSubCategory.SUPPLIER_MISCONDUCT]: ReportCategoryGroup.EXTERNAL_ENVIRONMENT,
    [ReportSubCategory.GENERAL_ETHICS_VIOLATION]: ReportCategoryGroup.EXTERNAL_ENVIRONMENT,
  };

export const REPORT_CATEGORY_CATALOG: readonly ReportCategoryCatalogEntry[] = [
  {
    groupCode: ReportCategoryGroup.EMPLOYEE_HUMAN,
    groupLabel: 'Çalışan ve İnsan Kaynakları',
    categories: [
      { code: ReportSubCategory.HARASSMENT, label: 'Taciz' },
      { code: ReportSubCategory.DISCRIMINATION, label: 'Ayrımcılık' },
      { code: ReportSubCategory.WORKPLACE_VIOLENCE, label: 'İşyeri Şiddeti' },
      { code: ReportSubCategory.HUMAN_RIGHTS_VIOLATION, label: 'İnsan Hakları İhlali' },
      { code: ReportSubCategory.RETALIATION, label: 'Misilleme' },
    ],
  },
  {
    groupCode: ReportCategoryGroup.ASSET_FINANCIAL,
    groupLabel: 'Hırsızlık, Zimmet, Dolandırıcılık, Suiistimal',
    categories: [
      { code: ReportSubCategory.THEFT, label: 'Hırsızlık' },
      { code: ReportSubCategory.EMBEZZLEMENT, label: 'Zimmet' },
      { code: ReportSubCategory.FRAUD, label: 'Dolandırıcılık' },
      { code: ReportSubCategory.MISUSE, label: 'Suiistimal' },
      { code: ReportSubCategory.BRIBERY_CORRUPTION_GIFT, label: 'Rüşvet, Yolsuzluk ve Hediye' },
    ],
  },
  {
    groupCode: ReportCategoryGroup.COMPLIANCE_LEGAL,
    groupLabel: 'Uyum ve Hukuk',
    categories: [
      { code: ReportSubCategory.CONFLICT_OF_INTEREST, label: 'Çıkar Çatışması' },
      { code: ReportSubCategory.INSIDER_TRADING, label: 'İçeriden Öğrenenler Ticareti' },
      { code: ReportSubCategory.DATA_PRIVACY_BREACH, label: 'Veri/Gizlilik İhlali' },
      { code: ReportSubCategory.REGULATORY_VIOLATION, label: 'Düzenleyici İhlal' },
    ],
  },
  {
    groupCode: ReportCategoryGroup.EXTERNAL_ENVIRONMENT,
    groupLabel: 'Çevre, İSG ve Dış Paydaşlar',
    categories: [
      { code: ReportSubCategory.ENVIRONMENTAL_VIOLATION, label: 'Çevre İhlali' },
      { code: ReportSubCategory.HEALTH_SAFETY_VIOLATION, label: 'İSG İhlali' },
      { code: ReportSubCategory.SUPPLIER_MISCONDUCT, label: 'Tedarikçi/İş Ortağı Suiistimali' },
      {
        code: ReportSubCategory.GENERAL_ETHICS_VIOLATION,
        label: 'Genel Etik İhlali / Emin Değilim',
      },
    ],
  },
] as const;
