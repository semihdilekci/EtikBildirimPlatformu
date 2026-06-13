import { ErrorCode } from '@ethics/shared';

import { ApiError } from '@/types/api.types';

const TRACKING_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Takip kodu veya şifre hatalı.',
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Çok fazla istek gönderildi. Lütfen bekleyin.',
};

export function getTrackingErrorMessage(error: unknown, fallback = 'Bir hata oluştu.'): string {
  if (error instanceof ApiError) {
    return TRACKING_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function isTrackingAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ErrorCode.AUTH_INVALID_CREDENTIALS ||
      error.code === ErrorCode.AUTH_ACCOUNT_LOCKED)
  );
}

export function isTrackingRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.code === ErrorCode.RATE_LIMIT_EXCEEDED;
}
