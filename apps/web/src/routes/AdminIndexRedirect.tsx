import { PermissionCode } from '@ethics/policy';
import { Navigate } from 'react-router-dom';

import { usePermissions } from '@/features/auth/hooks/usePermissions';

/** Admin kök yolu — role göre ilk erişilebilir ekrana yönlendirir. */
export function AdminIndexRedirect() {
  const { isAdmin, hasPermission } = usePermissions();

  if (isAdmin) {
    return <Navigate to="/app/admin/users" replace />;
  }

  if (hasPermission(PermissionCode.ADMIN_MANAGE_KVKK)) {
    return <Navigate to="/app/admin/kvkk-texts" replace />;
  }

  return <Navigate to="/403" replace />;
}
