export {
  PermissionCode,
  PERMISSION_CODE_VALUES,
  PUBLIC_PERMISSION_CODES,
  type PermissionCode as Permission,
} from './permissions.js';

export {
  ROLE_PERMISSION_MAP,
  getPermissionsForRole,
  roleHasPermission,
  rolesHavePermission,
} from './role-permission-map.js';

export {
  AbacScopeType,
  PolicyResourceType,
  ROLE_RESOURCE_ABAC_RULES,
  getClearanceRank,
  isClearanceSufficient,
  getAllowedClearanceLevels,
  getAbacRuleForRoleAndResource,
  resolveEffectiveAbacRule,
  type AbacScopeRule,
} from './abac-rules.js';

export {
  CaseField,
  CASE_FIELD_VALUES,
  FieldVisibility,
  FIELD_VISIBILITY_DEFAULTS,
  getFieldVisibility,
  isFieldVisible,
  resolveFieldVisibilityForRoles,
  type FieldVisibilityMatrix,
} from './field-visibility-defaults.js';

// Re-export shared identity enums for convenience (single import surface)
export { Role, ROLE_VALUES, ClearanceLevel, CLEARANCE_LEVEL_VALUES } from '@ethics/shared';
