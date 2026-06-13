/**
 * Audit metadata ve snapshot alanlarında plaintext içerik taşımayı engelleyen yasak anahtarlar.
 * Alt nesnelerde recursive tarama AuditEventPublisher tarafından yapılır.
 */
export const AUDIT_FORBIDDEN_METADATA_KEYS = [
  'report_text',
  'incident_description',
  'category_specific_data',
  'reporter_identity_name',
  'reporter_identity_email',
  'reporter_identity_phone',
  'reason_text',
  'decision_text',
  'action_response_text',
  'message_body',
  'document_content',
  'file_content',
  'plaintext',
  'password',
  'tracking_code_password',
  'token',
  'secret',
  'access_token',
  'refresh_token',
  'csrf_token',
] as const;

export type AuditForbiddenMetadataKey = (typeof AUDIT_FORBIDDEN_METADATA_KEYS)[number];
