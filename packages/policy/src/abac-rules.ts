import {
  ClearanceLevel,
  CLEARANCE_LEVEL_VALUES,
  Role,
  type ClearanceLevel as ClearanceLevelCode,
  type Role as RoleCode,
} from '@ethics/shared';

/** ABAC attribute türleri — Docs/07_SECURITY_IMPLEMENTATION.md §3.1 */
export const AbacScopeType = {
  COMPANY: 'company_scope',
  ASSIGNMENT: 'assignment_scope',
  FUNCTION_LOCATION: 'function_location_scope',
  CONFIDENTIALITY_CLEARANCE: 'confidentiality_clearance',
} as const;

export type AbacScopeType = (typeof AbacScopeType)[keyof typeof AbacScopeType];

export const PolicyResourceType = {
  CASE: 'case',
  TASK: 'task',
  DOCUMENT: 'document',
  SECURE_MESSAGE: 'secure_message',
} as const;

export type PolicyResourceType = (typeof PolicyResourceType)[keyof typeof PolicyResourceType];

export interface AbacScopeRule {
  readonly scopes: readonly AbacScopeType[];
  /** Admin rolü vaka içeriğine erişemez — liste sorgularında deny-all */
  readonly denyAll?: boolean;
}

/**
 * Rol × kaynak ABAC scope kuralları — §3.1 + §3.5 matris notları
 */
export const ROLE_RESOURCE_ABAC_RULES: Readonly<
  Record<RoleCode, Readonly<Partial<Record<PolicyResourceType, AbacScopeRule>>>>
> = {
  [Role.COUNCIL_SECRETARY]: {
    [PolicyResourceType.CASE]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.TASK]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE, AbacScopeType.ASSIGNMENT],
    },
    [PolicyResourceType.SECURE_MESSAGE]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
  },

  [Role.COUNCIL_CHAIR]: {
    [PolicyResourceType.CASE]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.TASK]: {
      scopes: [AbacScopeType.ASSIGNMENT, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE, AbacScopeType.ASSIGNMENT],
    },
  },

  [Role.COUNCIL_MEMBER]: {
    [PolicyResourceType.CASE]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.TASK]: {
      scopes: [AbacScopeType.ASSIGNMENT, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE, AbacScopeType.ASSIGNMENT],
    },
  },

  [Role.BOARD_CHAIR]: {
    [PolicyResourceType.CASE]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.TASK]: {
      scopes: [AbacScopeType.ASSIGNMENT, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [AbacScopeType.CONFIDENTIALITY_CLEARANCE, AbacScopeType.ASSIGNMENT],
    },
  },

  [Role.RAPPORTEUR]: {
    [PolicyResourceType.CASE]: {
      scopes: [AbacScopeType.ASSIGNMENT, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.TASK]: {
      scopes: [AbacScopeType.ASSIGNMENT, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [AbacScopeType.ASSIGNMENT, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
  },

  [Role.ACTION_OWNER]: {
    [PolicyResourceType.CASE]: {
      scopes: [AbacScopeType.COMPANY, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.TASK]: {
      scopes: [AbacScopeType.COMPANY, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [AbacScopeType.COMPANY, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
    },
  },

  [Role.ADMIN]: {
    [PolicyResourceType.CASE]: {
      // Metadata listeleme RBAC + FieldMasking ile; içerik alanları maskelenir (§3.5–3.6)
      scopes: [],
    },
    [PolicyResourceType.TASK]: {
      scopes: [],
      denyAll: true,
    },
    [PolicyResourceType.DOCUMENT]: {
      scopes: [],
      denyAll: true,
    },
    [PolicyResourceType.SECURE_MESSAGE]: {
      scopes: [],
      denyAll: true,
    },
  },
};

const CLEARANCE_RANK: Readonly<Record<ClearanceLevelCode, number>> = {
  [ClearanceLevel.NORMAL]: 0,
  [ClearanceLevel.SENSITIVE]: 1,
  [ClearanceLevel.STRICTLY_CONFIDENTIAL]: 2,
};

export function getClearanceRank(level: ClearanceLevelCode): number {
  return CLEARANCE_RANK[level];
}

export function isClearanceSufficient(
  userClearance: ClearanceLevelCode,
  resourceClearance: ClearanceLevelCode,
): boolean {
  return getClearanceRank(userClearance) >= getClearanceRank(resourceClearance);
}

export function getAllowedClearanceLevels(
  userClearance: ClearanceLevelCode,
): readonly ClearanceLevelCode[] {
  const userRank = getClearanceRank(userClearance);
  return CLEARANCE_LEVEL_VALUES.filter((level) => getClearanceRank(level) <= userRank);
}

export function getAbacRuleForRoleAndResource(
  role: RoleCode,
  resource: PolicyResourceType,
): AbacScopeRule | undefined {
  return ROLE_RESOURCE_ABAC_RULES[role][resource];
}

export function resolveEffectiveAbacRule(
  roles: readonly RoleCode[],
  resource: PolicyResourceType,
): AbacScopeRule | undefined {
  const rules = roles
    .map((role) => getAbacRuleForRoleAndResource(role, resource))
    .filter((rule): rule is AbacScopeRule => rule !== undefined);

  if (rules.length === 0) {
    return undefined;
  }

  if (rules.some((rule) => rule.denyAll === true)) {
    return { scopes: [], denyAll: true };
  }

  const scopeSet = new Set<AbacScopeType>();
  for (const rule of rules) {
    for (const scope of rule.scopes) {
      scopeSet.add(scope);
    }
  }

  return { scopes: [...scopeSet] };
}
