import { describe, expect, it } from 'vitest';

import {
  containsSensitiveEmailContent,
  escapeHtml,
  renderNotificationEmailTemplate,
} from '@ethics/shared';

describe('renderNotificationEmailTemplate', () => {
  it('plain text gövdeyi korur, HTML gövdede XSS karakterlerini escape eder', () => {
    const rendered = renderNotificationEmailTemplate({
      subjectTemplate: 'Yeni göreviniz var',
      bodyTemplate: 'Size yeni bir görev atanmıştır. <script>alert(1)</script>',
    });

    expect(rendered.textBody).toBe('Size yeni bir görev atanmıştır. <script>alert(1)</script>');
    expect(rendered.htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.htmlBody).not.toContain('<script>');
  });

  it('subjectTemplate null ise fallback subject kullanır', () => {
    const rendered = renderNotificationEmailTemplate({
      subjectTemplate: null,
      bodyTemplate: 'Platforma giriş yapınız.',
      fallbackSubject: 'Bildirim',
    });

    expect(rendered.subject).toBe('Bildirim');
  });
});

describe('escapeHtml', () => {
  it('HTML özel karakterlerini escape eder', () => {
    expect(escapeHtml(`Tom & Jerry "test"`)).toBe('Tom &amp; Jerry &quot;test&quot;');
  });
});

describe('containsSensitiveEmailContent', () => {
  it('hassas alan adı pattern eşleşmesini tespit eder', () => {
    expect(containsSensitiveEmailContent('report_text: gizli')).toBe(true);
    expect(containsSensitiveEmailContent('Platforma giriş yapınız.')).toBe(false);
  });
});
