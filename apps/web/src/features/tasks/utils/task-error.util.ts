import { ErrorCode } from '@ethics/shared';

import { ApiError } from '@/types/api.types';

const TASK_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ErrorCode.TASK_NOT_FOUND]: 'Görev bulunamadı veya erişim yetkiniz yok.',
  [ErrorCode.TASK_INVALID_STATE]: 'Görev bu durumda işlem yapılamaz.',
  [ErrorCode.TASK_COMPLETION_NOT_ALLOWED]: 'Bu görev tipi tamamlama ile ilerletilemez.',
  [ErrorCode.TASK_ALREADY_COMPLETED]: 'Bu görev zaten tamamlanmış.',
  [ErrorCode.TASK_DELEGATION_NOT_ALLOWED]: 'Bu görev devredilemez.',
  [ErrorCode.TASK_DELEGATION_INVALID_TARGET]:
    'Devir hedefi geçersiz veya görev rolüne sahip değil.',
  [ErrorCode.AUTHZ_FORBIDDEN]: 'Bu işlem için yetkiniz yok.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Görev bulunamadı veya erişim yetkiniz yok.',
  [ErrorCode.MAKER_CHECKER_SELF]: 'Kendi oluşturduğunuz onay talebini karara bağlayamazsınız.',
  [ErrorCode.MAKER_CHECKER_FORBIDDEN]: 'Bu onay işlemi için yetkiniz yok.',
  [ErrorCode.APPROVAL_WORK_ITEM_NOT_FOUND]: 'Onay işi bulunamadı veya erişim yetkiniz yok.',
  [ErrorCode.APPROVAL_WORK_ITEM_ALREADY_DECIDED]: 'Bu onay işi zaten karara bağlanmış.',
  [ErrorCode.APPROVAL_WORK_ITEM_UNSUPPORTED]: 'Bu onay işi türü desteklenmiyor.',
};

export function getTaskErrorMessage(error: unknown, fallback = 'Bir hata oluştu.'): string {
  if (error instanceof ApiError) {
    return TASK_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function isTaskNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 ||
      error.code === ErrorCode.RESOURCE_NOT_FOUND ||
      error.code === ErrorCode.TASK_NOT_FOUND)
  );
}

export function isTaskForbiddenError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.code === ErrorCode.AUTHZ_FORBIDDEN)
  );
}
