import { Navigate, Outlet } from 'react-router-dom';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthStore } from '@/stores/useAuthStore';

export function GuestGuard() {
  const status = useAuthStore((state) => state.status);
  useCurrentUser({ enabled: status === 'idle' || status === 'unauthenticated' });

  if (status === 'authenticated') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
