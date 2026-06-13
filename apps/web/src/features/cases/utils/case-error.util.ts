import { ErrorCode } from '@ethics/shared';

import { ApiError } from '@/types/api.types';

const CASE_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ErrorCode.CASE_INVALID_TRANSITION]: 'Bu işlem vakanın mevcut durumunda yapılamaz.',
  [ErrorCode.CASE_OPTIMISTIC_LOCK]:
    'Vaka başka bir kullanıcı tarafından güncellendi. Sayfa yenileniyor.',
  [ErrorCode.CASE_PRECONDITION_FAILED]: 'İşlem için gerekli ön koşullar sağlanmadı.',
  [ErrorCode.AUTHZ_FORBIDDEN]: 'Bu işlem için yetkiniz yok.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Vaka bulunamadı veya erişim yetkiniz yok.',
};

export function getCaseErrorMessage(error: unknown, fallback = 'Bir hata oluştu.'): string {
  if (error instanceof ApiError) {
    return CASE_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function isCaseNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.code === ErrorCode.RESOURCE_NOT_FOUND)
  );
}

export function isCaseForbiddenError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.code === ErrorCode.AUTHZ_FORBIDDEN)
  );
}

export function isCaseOptimisticLockError(error: unknown): boolean {
  return error instanceof ApiError && error.code === ErrorCode.CASE_OPTIMISTIC_LOCK;
}

export function isCaseInvalidTransitionError(error: unknown): boolean {
  return error instanceof ApiError && error.code === ErrorCode.CASE_INVALID_TRANSITION;
}
