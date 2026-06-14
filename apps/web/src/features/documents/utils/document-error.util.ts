import { ErrorCode } from '@ethics/shared';

import { ApiError } from '@/types/api.types';

const DOCUMENT_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ErrorCode.DOCUMENT_TYPE_NOT_ALLOWED]: 'İzin verilmeyen dosya türü.',
  [ErrorCode.DOCUMENT_SIZE_EXCEEDED]: 'Dosya boyutu sınırı aşıldı.',
  [ErrorCode.DOCUMENT_QUARANTINED]: 'Dosya henüz taranıyor, indirilemez.',
  [ErrorCode.DOCUMENT_REJECTED]: 'Doküman reddedildi — zararlı içerik tespit edildi.',
  [ErrorCode.AUTHZ_FORBIDDEN]: 'Bu işlem için yetkiniz yok.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Doküman bulunamadı veya erişim yetkiniz yok.',
  [ErrorCode.VALIDATION_FAILED]: 'Dosya doğrulaması başarısız.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Çok sayıda istek gönderildi, lütfen bekleyin.',
};

export function getDocumentErrorMessage(error: unknown, fallback = 'Bir hata oluştu.'): string {
  if (error instanceof ApiError) {
    return DOCUMENT_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function isDocumentNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.code === ErrorCode.RESOURCE_NOT_FOUND)
  );
}

export function isDocumentForbiddenError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.code === ErrorCode.AUTHZ_FORBIDDEN)
  );
}
