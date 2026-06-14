import {
  AdminActionCode,
  Role,
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

const ROLE_PRIVILEGE_RANK: Record<RoleCode, number> = {
  [Role.ADMIN]: 100,
  [Role.BOARD_CHAIR]: 90,
  [Role.COUNCIL_SECRETARY]: 80,
  [Role.COUNCIL_CHAIR]: 70,
  [Role.COUNCIL_MEMBER]: 60,
  [Role.RAPPORTEUR]: 50,
  [Role.ACTION_OWNER]: 40,
};

export function getCheckerRoleOptions(makerRole: RoleCode): RoleCode[] {
  const makerRank = ROLE_PRIVILEGE_RANK[makerRole];
  return (Object.entries(ROLE_PRIVILEGE_RANK) as [RoleCode, number][])
    .filter(([, rank]) => rank >= makerRank)
    .map(([role]) => role);
}

export function isSameMakerCheckerRole(makerRole: RoleCode, checkerRole: RoleCode): boolean {
  return makerRole === checkerRole;
}
