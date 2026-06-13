import { CaseField } from '@ethics/policy';

/** case_metadata — §3.6 metadata alanları */
export const CASE_METADATA_PROPERTIES = [
  'id',
  'case_number',
  'created_at',
  'updated_at',
  'company_id',
  'company_name',
  'category',
  'status',
  'workflow_state',
  'confidentiality_level',
] as const;

export type CaseMetadataProperty = (typeof CASE_METADATA_PROPERTIES)[number];

/** Policy CaseField → API/DTO property anahtarları */
export const CASE_FIELD_PROPERTY_MAP: Readonly<Record<CaseField, readonly string[]>> = {
  [CaseField.CASE_METADATA]: CASE_METADATA_PROPERTIES,
  [CaseField.REPORT_TEXT]: ['report_text', 'incident_description'],
  [CaseField.REPORTER_IDENTITY]: ['reporter_identity'],
  [CaseField.REPORTER_CONTACT]: ['reporter_contact'],
  [CaseField.INCIDENT_DATE]: ['incident_date'],
  [CaseField.INCIDENT_LOCATION]: ['incident_location'],
  [CaseField.INVOLVED_PERSONS]: ['involved_persons'],
  [CaseField.WITNESSES]: ['witnesses'],
  [CaseField.ATTACHMENTS]: ['attachments'],
  [CaseField.PRE_RESEARCH_NOTES]: ['pre_research_notes'],
  [CaseField.RAPPORTEUR_REPORT]: ['rapporteur_report'],
  [CaseField.COUNCIL_DECISION_DRAFT]: ['council_decision_draft'],
  [CaseField.COUNCIL_DECISION_FINAL]: ['council_decision_final'],
  [CaseField.ACTION_LETTER]: ['action_letter'],
  [CaseField.ACTION_RESPONSE]: ['action_response'],
  [CaseField.SECURE_MESSAGES]: ['secure_messages'],
};

/** Yanıttan her zaman çıkarılan iç bağlam alanları */
export const CASE_MASKING_CONTEXT_PROPERTIES = [
  'assigned_rapporteur_id',
  'assigned_action_owner_id',
] as const;

/** İçerik alanları — CASE_METADATA hariç */
export const CASE_CONTENT_FIELDS = [
  CaseField.REPORT_TEXT,
  CaseField.REPORTER_IDENTITY,
  CaseField.REPORTER_CONTACT,
  CaseField.INCIDENT_DATE,
  CaseField.INCIDENT_LOCATION,
  CaseField.INVOLVED_PERSONS,
  CaseField.WITNESSES,
  CaseField.ATTACHMENTS,
  CaseField.PRE_RESEARCH_NOTES,
  CaseField.RAPPORTEUR_REPORT,
  CaseField.COUNCIL_DECISION_DRAFT,
  CaseField.COUNCIL_DECISION_FINAL,
  CaseField.ACTION_LETTER,
  CaseField.ACTION_RESPONSE,
  CaseField.SECURE_MESSAGES,
] as const;
