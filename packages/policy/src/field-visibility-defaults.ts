import { Role, type Role as RoleCode } from '@ethics/shared';

/** Vaka alanları — Docs/07_SECURITY_IMPLEMENTATION.md §3.6 */
export const CaseField = {
  CASE_METADATA: 'case_metadata',
  REPORT_TEXT: 'report_text',
  REPORTER_IDENTITY: 'reporter_identity',
  REPORTER_CONTACT: 'reporter_contact',
  INCIDENT_DATE: 'incident_date',
  INCIDENT_LOCATION: 'incident_location',
  INVOLVED_PERSONS: 'involved_persons',
  WITNESSES: 'witnesses',
  ATTACHMENTS: 'attachments',
  PRE_RESEARCH_NOTES: 'pre_research_notes',
  RAPPORTEUR_REPORT: 'rapporteur_report',
  COUNCIL_DECISION_DRAFT: 'council_decision_draft',
  COUNCIL_DECISION_FINAL: 'council_decision_final',
  ACTION_LETTER: 'action_letter',
  ACTION_RESPONSE: 'action_response',
  SECURE_MESSAGES: 'secure_messages',
} as const;

export type CaseField = (typeof CaseField)[keyof typeof CaseField];

export const CASE_FIELD_VALUES = Object.values(CaseField) as readonly CaseField[];

/**
 * visible — tam erişim
 * own_only — yalnızca kullanıcının kendi kaynağı (rapporteur raporu, aksiyon mektubu)
 * metadata_only — admin: yalnızca metadata alanları
 * hidden — alan API yanıtına hiç eklenmez
 */
export const FieldVisibility = {
  VISIBLE: 'visible',
  OWN_ONLY: 'own_only',
  METADATA_ONLY: 'metadata_only',
  HIDDEN: 'hidden',
} as const;

export type FieldVisibility = (typeof FieldVisibility)[keyof typeof FieldVisibility];

export type FieldVisibilityMatrix = Readonly<
  Record<RoleCode, Readonly<Record<CaseField, FieldVisibility>>>
>;

/**
 * Varsayılan alan görünürlük matrisi — §3.6
 * FieldMaskingService (Faz 2 İterasyon 4) bu matrisi kullanır.
 */
export const FIELD_VISIBILITY_DEFAULTS: FieldVisibilityMatrix = {
  [Role.COUNCIL_SECRETARY]: {
    [CaseField.CASE_METADATA]: FieldVisibility.VISIBLE,
    [CaseField.REPORT_TEXT]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.VISIBLE,
    [CaseField.INCIDENT_DATE]: FieldVisibility.VISIBLE,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.VISIBLE,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.VISIBLE,
    [CaseField.WITNESSES]: FieldVisibility.VISIBLE,
    [CaseField.ATTACHMENTS]: FieldVisibility.VISIBLE,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.VISIBLE,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_LETTER]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.VISIBLE,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.VISIBLE,
  },

  [Role.COUNCIL_CHAIR]: {
    [CaseField.CASE_METADATA]: FieldVisibility.VISIBLE,
    [CaseField.REPORT_TEXT]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_DATE]: FieldVisibility.VISIBLE,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.VISIBLE,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.VISIBLE,
    [CaseField.WITNESSES]: FieldVisibility.VISIBLE,
    [CaseField.ATTACHMENTS]: FieldVisibility.VISIBLE,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.VISIBLE,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_LETTER]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.VISIBLE,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.HIDDEN,
  },

  [Role.COUNCIL_MEMBER]: {
    [CaseField.CASE_METADATA]: FieldVisibility.VISIBLE,
    [CaseField.REPORT_TEXT]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_DATE]: FieldVisibility.VISIBLE,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.VISIBLE,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.VISIBLE,
    [CaseField.WITNESSES]: FieldVisibility.HIDDEN,
    [CaseField.ATTACHMENTS]: FieldVisibility.VISIBLE,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.HIDDEN,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_LETTER]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.VISIBLE,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.HIDDEN,
  },

  [Role.BOARD_CHAIR]: {
    [CaseField.CASE_METADATA]: FieldVisibility.VISIBLE,
    [CaseField.REPORT_TEXT]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_DATE]: FieldVisibility.VISIBLE,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.VISIBLE,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.VISIBLE,
    [CaseField.WITNESSES]: FieldVisibility.VISIBLE,
    [CaseField.ATTACHMENTS]: FieldVisibility.VISIBLE,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.VISIBLE,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.VISIBLE,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.HIDDEN,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_LETTER]: FieldVisibility.VISIBLE,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.VISIBLE,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.HIDDEN,
  },

  [Role.RAPPORTEUR]: {
    [CaseField.CASE_METADATA]: FieldVisibility.VISIBLE,
    [CaseField.REPORT_TEXT]: FieldVisibility.VISIBLE,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_DATE]: FieldVisibility.VISIBLE,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.VISIBLE,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.VISIBLE,
    [CaseField.WITNESSES]: FieldVisibility.VISIBLE,
    [CaseField.ATTACHMENTS]: FieldVisibility.VISIBLE,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.VISIBLE,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.OWN_ONLY,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.HIDDEN,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.HIDDEN,
    [CaseField.ACTION_LETTER]: FieldVisibility.HIDDEN,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.HIDDEN,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.HIDDEN,
  },

  [Role.ACTION_OWNER]: {
    [CaseField.CASE_METADATA]: FieldVisibility.VISIBLE,
    [CaseField.REPORT_TEXT]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_DATE]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.HIDDEN,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.HIDDEN,
    [CaseField.WITNESSES]: FieldVisibility.HIDDEN,
    [CaseField.ATTACHMENTS]: FieldVisibility.HIDDEN,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.HIDDEN,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.HIDDEN,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.HIDDEN,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.HIDDEN,
    [CaseField.ACTION_LETTER]: FieldVisibility.OWN_ONLY,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.OWN_ONLY,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.HIDDEN,
  },

  [Role.ADMIN]: {
    [CaseField.CASE_METADATA]: FieldVisibility.METADATA_ONLY,
    [CaseField.REPORT_TEXT]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_IDENTITY]: FieldVisibility.HIDDEN,
    [CaseField.REPORTER_CONTACT]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_DATE]: FieldVisibility.HIDDEN,
    [CaseField.INCIDENT_LOCATION]: FieldVisibility.HIDDEN,
    [CaseField.INVOLVED_PERSONS]: FieldVisibility.HIDDEN,
    [CaseField.WITNESSES]: FieldVisibility.HIDDEN,
    [CaseField.ATTACHMENTS]: FieldVisibility.HIDDEN,
    [CaseField.PRE_RESEARCH_NOTES]: FieldVisibility.HIDDEN,
    [CaseField.RAPPORTEUR_REPORT]: FieldVisibility.HIDDEN,
    [CaseField.COUNCIL_DECISION_DRAFT]: FieldVisibility.HIDDEN,
    [CaseField.COUNCIL_DECISION_FINAL]: FieldVisibility.HIDDEN,
    [CaseField.ACTION_LETTER]: FieldVisibility.HIDDEN,
    [CaseField.ACTION_RESPONSE]: FieldVisibility.HIDDEN,
    [CaseField.SECURE_MESSAGES]: FieldVisibility.HIDDEN,
  },
};

export function getFieldVisibility(role: RoleCode, field: CaseField): FieldVisibility {
  return FIELD_VISIBILITY_DEFAULTS[role][field];
}

export function isFieldVisible(role: RoleCode, field: CaseField): boolean {
  const visibility = getFieldVisibility(role, field);
  return visibility === FieldVisibility.VISIBLE || visibility === FieldVisibility.METADATA_ONLY;
}

export function resolveFieldVisibilityForRoles(
  roles: readonly RoleCode[],
  field: CaseField,
): FieldVisibility {
  if (roles.length === 0) {
    return FieldVisibility.HIDDEN;
  }

  const visibilities = roles.map((role) => getFieldVisibility(role, field));

  if (visibilities.includes(FieldVisibility.VISIBLE)) {
    return FieldVisibility.VISIBLE;
  }
  if (visibilities.includes(FieldVisibility.OWN_ONLY)) {
    return FieldVisibility.OWN_ONLY;
  }
  if (visibilities.includes(FieldVisibility.METADATA_ONLY)) {
    return FieldVisibility.METADATA_ONLY;
  }

  return FieldVisibility.HIDDEN;
}
