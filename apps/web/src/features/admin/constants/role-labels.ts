import { Role, ROLE_VALUES, type Role as RoleCode } from '@ethics/shared';

export const ROLE_LABELS: Readonly<Record<RoleCode, string>> = {
  [Role.COUNCIL_SECRETARY]: 'Kurul Sekreteri',
  [Role.COUNCIL_CHAIR]: 'Kurul Başkanı',
  [Role.COUNCIL_MEMBER]: 'Kurul Üyesi',
  [Role.RAPPORTEUR]: 'Rapportör',
  [Role.BOARD_CHAIR]: 'Yönetim Kurulu Başkanı',
  [Role.ACTION_OWNER]: 'Aksiyon Sahibi',
  [Role.ADMIN]: 'Sistem Yöneticisi',
};

export function getRoleLabel(roleCode: RoleCode): string {
  return ROLE_LABELS[roleCode];
}

export const ASSIGNABLE_ROLE_OPTIONS = ROLE_VALUES.map((roleCode) => ({
  value: roleCode,
  label: getRoleLabel(roleCode),
}));
