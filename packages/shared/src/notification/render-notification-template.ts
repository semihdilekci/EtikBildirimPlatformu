export const DEFAULT_NOTIFICATION_EMAIL_SUBJECT = 'Etik Bildirim Platformu';

/** Hassas alan adları — e-posta gövdesinde bulunmamalı (Faz 8 güvenlik). */
export const SENSITIVE_EMAIL_CONTENT_PATTERNS = [
  /report_text/i,
  /incident_description/i,
  /reporter_identity/i,
  /category_specific_data/i,
] as const;

export interface NotificationTemplateRenderInput {
  subjectTemplate: string | null;
  bodyTemplate: string;
  fallbackSubject?: string;
}

export interface RenderedNotificationEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderNotificationEmailTemplate(
  input: NotificationTemplateRenderInput,
): RenderedNotificationEmail {
  const subject = (
    input.subjectTemplate ??
    input.fallbackSubject ??
    DEFAULT_NOTIFICATION_EMAIL_SUBJECT
  ).trim();
  const textBody = input.bodyTemplate.trim();
  const escapedSubject = escapeHtml(subject);
  const escapedBody = escapeHtml(textBody);

  const htmlBody = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>${escapedSubject}</title></head>
<body><p>${escapedBody}</p><p>${escapeHtml(DEFAULT_NOTIFICATION_EMAIL_SUBJECT)}</p></body>
</html>`;

  return { subject, textBody, htmlBody };
}

export function containsSensitiveEmailContent(body: string): boolean {
  return SENSITIVE_EMAIL_CONTENT_PATTERNS.some((pattern) => pattern.test(body));
}
