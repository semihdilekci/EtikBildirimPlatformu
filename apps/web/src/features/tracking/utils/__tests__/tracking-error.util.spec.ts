import { ErrorCode } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import {
  getTrackingErrorMessage,
  isTrackingAuthError,
  isTrackingRateLimitError,
} from '@/features/tracking/utils/tracking-error.util';
import { ApiError } from '@/types/api.types';

describe('tracking-error.util', () => {
  it('maps known tracking error codes to Turkish messages', () => {
    const error = new ApiError({
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      message: 'Backend message',
      requestId: 'req-1',
      status: 401,
    });

    expect(getTrackingErrorMessage(error)).toBe('Takip kodu veya şifre hatalı.');
    expect(isTrackingAuthError(error)).toBe(true);
    expect(isTrackingRateLimitError(error)).toBe(false);
  });

  it('maps rate limit errors', () => {
    const error = new ApiError({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests',
      requestId: 'req-2',
      status: 429,
    });

    expect(getTrackingErrorMessage(error)).toBe('Çok fazla istek gönderildi. Lütfen bekleyin.');
    expect(isTrackingRateLimitError(error)).toBe(true);
  });
});
