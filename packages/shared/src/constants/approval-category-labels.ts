import { ApprovalCategory, type ApprovalCategoryCode } from '../enums/approval-category.enum.js';

export const APPROVAL_CATEGORY_LABELS: Record<ApprovalCategoryCode, string> = {
  [ApprovalCategory.ROLE_ASSIGNMENT]: 'Rol Ataması Onayı',
  [ApprovalCategory.CLEARANCE_CHANGE]: 'Clearance Değişikliği Onayı',
  [ApprovalCategory.SYSTEM_SETTING_CHANGE]: 'Sistem Ayarı Değişikliği Onayı',
  [ApprovalCategory.FIELD_VISIBILITY_CHANGE]: 'Alan Görünürlüğü Değişikliği Onayı',
  [ApprovalCategory.ACTION_MATRIX_CHANGE]: 'Aksiyon Matrisi Değişikliği Onayı',
  [ApprovalCategory.SLA_POLICY_CHANGE]: 'SLA Politikası Değişikliği Onayı',
  [ApprovalCategory.NOTIFICATION_TEMPLATE_CHANGE]: 'Bildirim Şablonu Değişikliği Onayı',
  [ApprovalCategory.KVKK_TEXT_PUBLISH]: 'KVKK Metni Yayın Onayı',
};

export function getApprovalCategoryLabel(category: ApprovalCategoryCode): string {
  return APPROVAL_CATEGORY_LABELS[category];
}
