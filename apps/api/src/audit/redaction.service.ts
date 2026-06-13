import { Inject, Injectable } from '@nestjs/common';

import { EnvService } from '../common/config/env.service.js';
import type { EncryptedFieldResult } from '../crypto/crypto.types.js';
import {
  EMAIL_INLINE_PATTERN,
  ENCRYPTED_CONTENT_FIELD_KEYS,
  isEncryptedContentFieldKey,
  isSensitiveFieldKey,
  MASKED_EMAIL,
  MASKED_PHONE,
  MASKED_SECRET,
  PHONE_INLINE_PATTERN,
  REDACTED_PLACEHOLDER,
} from './redaction.constants.js';

@Injectable()
export class RedactionService {
  constructor(@Inject(EnvService) private readonly envService: EnvService) {}

  isRedactionEnabled(): boolean {
    if (this.envService.isProduction) {
      return true;
    }
    return this.envService.logRedactionEnabled;
  }

  /**
   * Log bağlamı için derin redaction — hassas anahtarlar ve inline PII maskelenir.
   */
  redactForLog(value: unknown): unknown {
    if (!this.isRedactionEnabled()) {
      return value;
    }
    return this.redactValue(value, undefined, 'log');
  }

  /**
   * Audit snapshot / viewer için — şifreli içerik alanları [REDACTED].
   */
  redactAuditSnapshot(value: unknown): unknown {
    if (!this.isRedactionEnabled()) {
      return value;
    }
    return this.redactValue(value, undefined, 'audit');
  }

  redactString(text: string): string {
    if (!this.isRedactionEnabled()) {
      return text;
    }

    return text
      .replace(EMAIL_INLINE_PATTERN, MASKED_EMAIL)
      .replace(PHONE_INLINE_PATTERN, MASKED_PHONE);
  }

  getEncryptedContentFieldKeys(): readonly string[] {
    return ENCRYPTED_CONTENT_FIELD_KEYS;
  }

  private redactValue(value: unknown, key: string | undefined, mode: 'log' | 'audit'): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (this.isEncryptedPayload(value)) {
      return REDACTED_PLACEHOLDER;
    }

    if (typeof value === 'string') {
      if (key !== undefined && this.shouldRedactKey(key, mode)) {
        return this.redactKeyValue(key, value, mode);
      }
      return this.redactString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item, key, mode));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [entryKey, entryValue] of Object.entries(value)) {
        result[entryKey] = this.redactValue(entryValue, entryKey, mode);
      }
      return result;
    }

    return value;
  }

  private shouldRedactKey(key: string, mode: 'log' | 'audit'): boolean {
    if (mode === 'audit' && isEncryptedContentFieldKey(key)) {
      return true;
    }
    return isSensitiveFieldKey(key) || isEncryptedContentFieldKey(key);
  }

  private redactKeyValue(key: string, value: string, mode: 'log' | 'audit'): string {
    if (mode === 'audit' && isEncryptedContentFieldKey(key)) {
      return REDACTED_PLACEHOLDER;
    }

    if (/email/i.test(key)) {
      return MASKED_EMAIL;
    }

    if (/phone/i.test(key)) {
      return MASKED_PHONE;
    }

    if (/password|token|secret|content|body|description|plaintext/i.test(key)) {
      return mode === 'audit' ? REDACTED_PLACEHOLDER : MASKED_SECRET;
    }

    return REDACTED_PLACEHOLDER;
  }

  private isEncryptedPayload(value: unknown): value is EncryptedFieldResult {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.ciphertext === 'string' &&
      typeof candidate.encryptedDek === 'string' &&
      typeof candidate.algorithm === 'string'
    );
  }
}
