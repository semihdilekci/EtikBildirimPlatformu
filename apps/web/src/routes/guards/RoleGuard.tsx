import type { Role as RoleCode } from '@ethics/shared';
import { Navigate, Outlet } from 'react-router-dom';

import { usePermissions } from '@/features/auth/hooks/usePermissions';

interface RoleGuardProps {
  roles: readonly RoleCode[];
}

/**
 * Route-level rol kontrolü (UX). Yetersiz rol → /403.
 * Backend PolicyGuard enforcement zorunludur.
 */
export function RoleGuard({ roles }: RoleGuardProps) {
  const { hasAnyRole } = usePermissions();

  if (!hasAnyRole(roles)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
