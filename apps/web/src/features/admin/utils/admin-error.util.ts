import { ErrorCode } from '@ethics/shared';

import { ApiError } from '@/types/api.types';

const ADMIN_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ErrorCode.MAKER_CHECKER_SELF]: 'Aynı kişi hem talep eden hem onaylayan olamaz.',
  [ErrorCode.MAKER_CHECKER_REQUIRED]: 'İşlem çift onay gerektiriyor. Onay bekleniyor.',
  [ErrorCode.MAKER_CHECKER_FORBIDDEN]: 'Bu onay işlemi için yetkiniz yok.',
  [ErrorCode.ADMIN_USER_NOT_FOUND]: 'Kullanıcı bulunamadı.',
  [ErrorCode.ADMIN_ROLE_ALREADY_ACTIVE]: 'Kullanıcıda bu rol zaten aktif.',
  [ErrorCode.ADMIN_ROLE_NOT_FOUND]: 'Rol ataması bulunamadı.',
  [ErrorCode.ADMIN_ROLE_PENDING]: 'Bu rol için zaten onay bekleyen bir atama var.',
  [ErrorCode.ADMIN_CLEARANCE_INVALID]: 'Geçersiz yetki seviyesi.',
  [ErrorCode.ADMIN_CLEARANCE_REQUEST_NOT_FOUND]: 'Clearance değişiklik talebi bulunamadı.',
  [ErrorCode.ADMIN_CLEARANCE_UNCHANGED]: 'Yetki seviyesi zaten bu değerde.',
  [ErrorCode.ADMIN_SYSTEM_SETTING_NOT_FOUND]: 'Sistem parametresi bulunamadı.',
  [ErrorCode.ADMIN_SYSTEM_SETTING_UNCHANGED]: 'Parametre değeri değişmedi.',
  [ErrorCode.ADMIN_SYSTEM_SETTING_PENDING]:
    'Bu parametre için zaten onay bekleyen bir değişiklik var.',
  [ErrorCode.ADMIN_SYSTEM_SETTING_INVALID_VALUE]: 'Geçersiz parametre değeri.',
  [ErrorCode.ADMIN_SYSTEM_SETTING_BATCH_NOT_FOUND]: 'Onay batch kaydı bulunamadı.',
  [ErrorCode.ADMIN_FIELD_VISIBILITY_UNCHANGED]: 'Alan görünürlüğü değişmedi.',
  [ErrorCode.ADMIN_FIELD_VISIBILITY_PENDING]:
    'Bu alan için zaten onay bekleyen bir değişiklik var.',
  [ErrorCode.ADMIN_FIELD_VISIBILITY_BATCH_NOT_FOUND]: 'Onay batch kaydı bulunamadı.',
  [ErrorCode.ADMIN_FIELD_VISIBILITY_INVALID]: 'Geçersiz alan görünürlük değeri.',
  [ErrorCode.ADMIN_FIELD_VISIBILITY_ADMIN_PROTECTED]: 'Admin rolü bu alanı göremez.',
  [ErrorCode.ADMIN_ACTION_MATRIX_NOT_FOUND]: 'Aksiyon matrisi kaydı bulunamadı.',
  [ErrorCode.ADMIN_ACTION_MATRIX_UNCHANGED]: 'Aksiyon matrisi değişmedi.',
  [ErrorCode.ADMIN_ACTION_MATRIX_PENDING]:
    'Bu aksiyon için zaten onay bekleyen bir değişiklik var.',
  [ErrorCode.ADMIN_ACTION_MATRIX_BATCH_NOT_FOUND]: 'Onay batch kaydı bulunamadı.',
  [ErrorCode.ADMIN_ACTION_MATRIX_INVALID_ROLES]: 'Geçersiz maker/checker rol seçimi.',
  [ErrorCode.ADMIN_SLA_POLICY_NOT_FOUND]: 'SLA politikası bulunamadı.',
  [ErrorCode.ADMIN_SLA_POLICY_UNCHANGED]: 'SLA politikası değişmedi.',
  [ErrorCode.ADMIN_SLA_POLICY_PENDING]: 'Bu SLA için zaten onay bekleyen bir değişiklik var.',
  [ErrorCode.ADMIN_SLA_POLICY_BATCH_NOT_FOUND]: 'Onay batch kaydı bulunamadı.',
  [ErrorCode.ADMIN_SLA_POLICY_INVALID]: 'Geçersiz SLA değeri.',
  [ErrorCode.ADMIN_BUSINESS_CALENDAR_NOT_FOUND]: 'Takvim kaydı bulunamadı.',
  [ErrorCode.ADMIN_BUSINESS_CALENDAR_DATE_CONFLICT]: 'Bu tarih için zaten bir kayıt var.',
  [ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_NOT_FOUND]: 'Bildirim şablonu bulunamadı.',
  [ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_UNCHANGED]: 'Şablon değişmedi.',
  [ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_PENDING]:
    'Bu şablon için zaten onay bekleyen bir değişiklik var.',
  [ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_BATCH_NOT_FOUND]: 'Onay batch kaydı bulunamadı.',
  [ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_INVALID]: 'Geçersiz şablon değeri.',
  [ErrorCode.ADMIN_NOTIFICATION_TEMPLATE_SENSITIVE_CONTENT]:
    'Şablonda hassas içerik tespit edildi.',
  [ErrorCode.ADMIN_KVKK_TEXT_VERSION_CONFLICT]: 'Bu versiyon kodu zaten mevcut.',
  [ErrorCode.ADMIN_KVKK_TEXT_PENDING]: 'Zaten onay bekleyen bir KVKK metni var.',
  [ErrorCode.ADMIN_KVKK_TEXT_BATCH_NOT_FOUND]: 'Onay batch kaydı bulunamadı.',
  [ErrorCode.ADMIN_KVKK_TEXT_INVALID]: 'Geçersiz KVKK metni.',
  [ErrorCode.AUTHZ_FORBIDDEN]: 'Bu işlem için yetkiniz yok.',
};

export function getAdminErrorMessage(error: unknown, fallback = 'Bir hata oluştu.'): string {
  if (error instanceof ApiError) {
    return ADMIN_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function isAdminUserNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.code === ErrorCode.ADMIN_USER_NOT_FOUND)
  );
}
