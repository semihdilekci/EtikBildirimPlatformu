import {
  AdminActionCode,
  ROLE_VALUES,
  type AdminActionCodeValue,
  type Role as RoleCode,
} from '@ethics/shared';

export const ACTION_MATRIX_LABELS: Readonly<Record<AdminActionCodeValue, string>> = {
  [AdminActionCode.ROLE_ASSIGN]: 'Rol Atama',
  [AdminActionCode.ROLE_ASSIGN_COUNCIL_SECRETARY]: 'Kurul Sekreteri Rol Atama',
  [AdminActionCode.ROLE_ASSIGN_BOARD_CHAIR]: 'YK Başkanı Rol Atama',
  [AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL]:
    'STRICTLY_CONFIDENTIAL Clearance Yükseltme',
  [AdminActionCode.SYSTEM_SETTING_CHANGE]: 'Sistem Ayarı Değişikliği',
  [AdminActionCode.FIELD_VISIBILITY_CHANGE]: 'Alan Görünürlük Değişikliği',
  [AdminActionCode.ACTION_MATRIX_CHANGE]: 'Aksiyon Matrisi Değişikliği',
  [AdminActionCode.SLA_POLICY_CHANGE]: 'SLA Politikası Değişikliği',
  [AdminActionCode.NOTIFICATION_TEMPLATE_CHANGE]: 'Bildirim Şablonu Değişikliği',
  [AdminActionCode.KVKK_TEXT_PUBLISH]: 'KVKK Metin Yayını',
};

export function getActionMatrixLabel(actionCode: string): string {
  if (Object.hasOwn(ACTION_MATRIX_LABELS, actionCode)) {
    return ACTION_MATRIX_LABELS[actionCode as AdminActionCodeValue];
  }
  return actionCode;
}

export function getCheckerRoleOptions(makerRole: RoleCode): RoleCode[] {
  return ROLE_VALUES.filter((role) => role !== makerRole);
}

export function isSameMakerCheckerRole(makerRole: RoleCode, checkerRole: RoleCode): boolean {
  return makerRole === checkerRole;
}
