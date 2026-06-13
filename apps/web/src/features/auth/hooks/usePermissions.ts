import { getPermissionsForRole, rolesHavePermission, type PermissionCode } from '@ethics/policy';
import { Role, type Role as RoleCode } from '@ethics/shared';
import { useMemo } from 'react';

import { useAuthStore } from '@/stores/useAuthStore';

function buildPermissionSet(roles: readonly RoleCode[]): ReadonlySet<PermissionCode> {
  const permissions = new Set<PermissionCode>();
  for (const role of roles) {
    for (const permission of getPermissionsForRole(role)) {
      permissions.add(permission);
    }
  }
  return permissions;
}

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const roles = user?.roles ?? [];

  return useMemo(() => {
    const permissions = buildPermissionSet(roles);

    return {
      roles,
      permissions,
      hasRole: (role: RoleCode) => roles.includes(role),
      hasAnyRole: (requiredRoles: readonly RoleCode[]) =>
        requiredRoles.some((role) => roles.includes(role)),
      hasPermission: (permission: PermissionCode) => rolesHavePermission(roles, permission),
      isAdmin: roles.includes(Role.ADMIN),
    };
  }, [roles]);
}
