import {
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

/** Docs/07 §11.1 varsayılan aksiyon matrisi — Faz 9 İterasyon 4'te DB'ye taşınır */
export const DEFAULT_ACTION_MATRIX: readonly ActionMatrixEntry[] = [
  {
    actionCode: AdminActionCode.ROLE_ASSIGN,
    makerRole: Role.ADMIN,
    checkerRole: Role.COUNCIL_SECRETARY,
  },
  {
    actionCode: AdminActionCode.ROLE_ASSIGN_COUNCIL_SECRETARY,
    makerRole: Role.ADMIN,
    checkerRole: Role.BOARD_CHAIR,
  },
  {
    actionCode: AdminActionCode.ROLE_ASSIGN_BOARD_CHAIR,
    makerRole: Role.ADMIN,
    checkerRole: Role.ADMIN,
  },
  {
    actionCode: AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL,
    makerRole: Role.COUNCIL_SECRETARY,
    checkerRole: Role.COUNCIL_CHAIR,
  },
  {
    actionCode: AdminActionCode.SYSTEM_SETTING_CHANGE,
    makerRole: Role.ADMIN,
    checkerRole: Role.ADMIN,
  },
  {
    actionCode: AdminActionCode.FIELD_VISIBILITY_CHANGE,
    makerRole: Role.ADMIN,
    checkerRole: Role.ADMIN,
  },
  {
    actionCode: AdminActionCode.ACTION_MATRIX_CHANGE,
    makerRole: Role.ADMIN,
    checkerRole: Role.ADMIN,
  },
  {
    actionCode: AdminActionCode.SLA_POLICY_CHANGE,
    makerRole: Role.ADMIN,
    checkerRole: Role.ADMIN,
  },
  {
    actionCode: AdminActionCode.NOTIFICATION_TEMPLATE_CHANGE,
    makerRole: Role.COUNCIL_SECRETARY,
    checkerRole: Role.ADMIN,
  },
  {
    actionCode: AdminActionCode.KVKK_TEXT_PUBLISH,
    makerRole: Role.COUNCIL_SECRETARY,
    checkerRole: Role.ADMIN,
  },
] as const;

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
