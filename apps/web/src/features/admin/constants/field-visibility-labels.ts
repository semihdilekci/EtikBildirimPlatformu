import type { FieldVisibilityLevel } from '@ethics/dto';
import { Role, type Role as RoleCode } from '@ethics/shared';

export const FIELD_VISIBILITY_LABELS: Readonly<Record<string, string>> = {
  case_metadata: 'Vaka Metadata',
  report_text: 'Bildirim Metni',
  reporter_identity: 'Bildirimci Kimliği',
  reporter_contact: 'Bildirimci İletişim',
  incident_date: 'Olay Tarihi',
  incident_location: 'Olay Yeri',
  involved_persons: 'İlgili Kişiler',
  witnesses: 'Tanıklar',
  attachments: 'Ekler',
  pre_research_notes: 'Ön Araştırma Notları',
  rapporteur_report: 'Raportör Raporu',
  council_decision_draft: 'Karar Taslağı',
  council_decision_final: 'Nihai Karar',
  action_letter: 'Aksiyon Mektubu',
  action_response: 'Aksiyon Yanıtı',
  secure_messages: 'Güvenli Mesajlar',
};

export function getFieldVisibilityLabel(fieldName: string): string {
  return FIELD_VISIBILITY_LABELS[fieldName] ?? fieldName;
}

export const FIELD_VISIBILITY_LEVEL_LABELS: Readonly<Record<FieldVisibilityLevel, string>> = {
  visible: 'Görünür',
  own_only: 'Yalnızca Kendi',
  metadata_only: 'Yalnızca Metadata',
  hidden: 'Gizli',
};

const ADMIN_CONTENT_FIELDS = new Set([
  'report_text',
  'reporter_identity',
  'reporter_contact',
  'incident_date',
  'incident_location',
  'involved_persons',
  'witnesses',
  'attachments',
  'pre_research_notes',
  'rapporteur_report',
  'council_decision_draft',
  'council_decision_final',
  'action_letter',
  'action_response',
  'secure_messages',
]);

export function isFieldVisibilityCellDisabled(
  roleCode: string,
  fieldName: string,
): { disabled: boolean; tooltip?: string } {
  if (
    roleCode === Role.ADMIN &&
    fieldName !== 'case_metadata' &&
    ADMIN_CONTENT_FIELDS.has(fieldName)
  ) {
    return { disabled: true, tooltip: 'Admin içerik göremez' };
  }

  if (roleCode === Role.COUNCIL_SECRETARY && fieldName === 'secure_messages') {
    return { disabled: true, tooltip: 'Sekreterya için zorunlu görünürlük' };
  }

  return { disabled: false };
}

export function isVisibilityChecked(visibility: FieldVisibilityLevel): boolean {
  return visibility === 'visible' || visibility === 'metadata_only' || visibility === 'own_only';
}

export function toggleVisibility(
  current: FieldVisibilityLevel,
  roleCode: RoleCode,
  fieldName: string,
): FieldVisibilityLevel {
  if (isVisibilityChecked(current)) {
    return 'hidden';
  }

  if (roleCode === Role.ADMIN && fieldName === 'case_metadata') {
    return 'metadata_only';
  }

  return 'visible';
}
