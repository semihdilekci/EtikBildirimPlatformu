import {
  ADMIN_ACTION_CODE_VALUES,
  AdminActionCode,
  Role,
  type AdminActionCodeValue,
  type Role as RoleCode,
} from '@ethics/shared';

export interface ActionMatrixEntry {
  actionCode: AdminActionCodeValue;
  makerRole: RoleCode;
  checkerRole: RoleCode;
}

/** Docs/07 §11.1 varsayılan aksiyon matrisi — seed + DB override kaynağı */
export const DEFAULT_ACTION_MATRIX: readonly ActionMatrixEntry[] = ADMIN_ACTION_CODE_VALUES.map(
  (actionCode) => ({
    actionCode,
    makerRole: Role.ADMIN,
    checkerRole: Role.COUNCIL_SECRETARY,
  }),
);

const ROLE_PRIVILEGE_RANK: Record<RoleCode, number> = {
  [Role.ADMIN]: 100,
  [Role.BOARD_CHAIR]: 90,
  [Role.COUNCIL_SECRETARY]: 80,
  [Role.COUNCIL_CHAIR]: 70,
  [Role.COUNCIL_MEMBER]: 60,
  [Role.RAPPORTEUR]: 50,
  [Role.ACTION_OWNER]: 40,
};

export function getRolePrivilegeRank(role: RoleCode): number {
  return ROLE_PRIVILEGE_RANK[role];
}

export function resolveRoleAssignmentActionCode(roleCode: RoleCode): AdminActionCodeValue {
  if (roleCode === Role.COUNCIL_SECRETARY) {
    return AdminActionCode.ROLE_ASSIGN_COUNCIL_SECRETARY;
  }

  if (roleCode === Role.BOARD_CHAIR) {
    return AdminActionCode.ROLE_ASSIGN_BOARD_CHAIR;
  }

  return AdminActionCode.ROLE_ASSIGN;
}

export function getActionMatrixEntry(actionCode: AdminActionCodeValue): ActionMatrixEntry {
  const entry = DEFAULT_ACTION_MATRIX.find((item) => item.actionCode === actionCode);
  if (!entry) {
    throw new Error(`Unknown admin action code: ${actionCode}`);
  }

  return entry;
}
