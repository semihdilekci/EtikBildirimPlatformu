import type { PermissionCode } from '@ethics/policy';
import type { Role as RoleCode } from '@ethics/shared';
import type { ReactNode } from 'react';

import { usePermissions } from '@/features/auth/hooks/usePermissions';

interface PermissionGateProps {
  children: ReactNode;
  permission?: PermissionCode;
  roles?: readonly RoleCode[];
  fallback?: ReactNode;
}

/**
 * UX-only visibility gate. Backend PolicyGuard enforcement zorunludur.
 */
export function PermissionGate({
  children,
  permission,
  roles,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyRole } = usePermissions();

  const allowedByPermission = permission === undefined || hasPermission(permission);
  const allowedByRole = roles === undefined || roles.length === 0 || hasAnyRole(roles);

  if (!allowedByPermission || !allowedByRole) {
    return fallback;
  }

  return children;
}
