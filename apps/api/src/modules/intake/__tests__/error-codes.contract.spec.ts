import { ErrorCode } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

/**
 * Docs/03_API_CONTRACTS.md §Error Taxonomy — intake + tracking error code spot-check.
 * Enum değerleri API sözleşmesiyle birebir eşleşmeli.
 */
const INTAKE_TRACKING_ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTAKE_KVKK_VERSION_MISMATCH: 'INTAKE_KVKK_VERSION_MISMATCH',
  MASTER_DATA_INACTIVE: 'MASTER_DATA_INACTIVE',
  DOCUMENT_TYPE_NOT_ALLOWED: 'DOCUMENT_TYPE_NOT_ALLOWED',
} as const;

describe('Intake + Tracking error codes (03 contract spot-check)', () => {
  it('shared ErrorCode enum intake/tracking kodlarıyla eşleşir', () => {
    for (const [key, value] of Object.entries(INTAKE_TRACKING_ERROR_CODES)) {
      expect(ErrorCode[key as keyof typeof ErrorCode]).toBe(value);
    }
  });

  it('tracking auth hata kodları string literal olarak sabit', () => {
    expect(ErrorCode.AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');
    expect(ErrorCode.AUTH_ACCOUNT_LOCKED).toBe('AUTH_ACCOUNT_LOCKED');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('intake validation hata kodları string literal olarak sabit', () => {
    expect(ErrorCode.INTAKE_KVKK_VERSION_MISMATCH).toBe('INTAKE_KVKK_VERSION_MISMATCH');
    expect(ErrorCode.MASTER_DATA_INACTIVE).toBe('MASTER_DATA_INACTIVE');
  });
});
