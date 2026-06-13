import { AUDIT_FORBIDDEN_METADATA_KEYS } from '@ethics/shared';

export const REDACTED_PLACEHOLDER = '[REDACTED]' as const;
export const MASKED_EMAIL = '***@***.com' as const;
export const MASKED_PHONE = '***' as const;
export const MASKED_SECRET = '***' as const;

/**
 * Alan adı eşleşmesi — log ve audit snapshot redaction.
 * Spec: password, token, secret, email, phone, description, body, content
 */
export const SENSITIVE_FIELD_KEY_PATTERNS: readonly RegExp[] = [
  /password/i,
  /token/i,
  /secret/i,
  /email/i,
  /phone/i,
  /description/i,
  /\bbody\b/i,
  /content/i,
];

/**
 * Şifreli içerik alanları — audit snapshot'ta [REDACTED] olarak gösterilir.
 */
export const ENCRYPTED_CONTENT_FIELD_KEYS: readonly string[] = [
  ...AUDIT_FORBIDDEN_METADATA_KEYS,
  'incident_description',
  'involved_persons',
  'witnesses',
  'reporter_identity_name',
  'reporter_identity_email',
  'reporter_identity_phone',
  'action_letter',
  'action_response_text',
  'reason_text',
  'decision_text',
];

const ENCRYPTED_CONTENT_FIELD_KEY_SET = new Set<string>(ENCRYPTED_CONTENT_FIELD_KEYS);

export function isEncryptedContentFieldKey(key: string): boolean {
  return ENCRYPTED_CONTENT_FIELD_KEY_SET.has(key);
}

export function isSensitiveFieldKey(key: string): boolean {
  return SENSITIVE_FIELD_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/** Pino HTTP logger için statik redact path'leri */
export const PINO_STATIC_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-tracking-password"]',
  'req.body.password',
  'req.body.token',
  'req.body.secret',
  'req.body.email',
  'req.body.phone',
  'req.body.report_text',
  'req.body.incident_description',
  'req.body.message_body',
  '*.password',
  '*.token',
  '*.secret',
  '*.access_token',
  '*.refresh_token',
  '*.csrf_token',
  '*.tracking_code_password',
  '*.report_text',
  '*.incident_description',
  '*.message_body',
  '*.document_content',
  '*.file_content',
  '*.plaintext',
];

export function buildPinoRedactPaths(): string[] {
  return [...PINO_STATIC_REDACT_PATHS];
}

/** Inline string içindeki e-posta ve telefon desenleri */
export const EMAIL_INLINE_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** TR ve uluslararası telefon — basit eşleşme */
export const PHONE_INLINE_PATTERN =
  /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g;
