import { Navigate, Outlet } from 'react-router-dom';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthStore } from '@/stores/useAuthStore';

export function GuestGuard() {
  const status = useAuthStore((state) => state.status);
  // Oturum yalnızca ilk yüklemede (idle) sorgulanır; unauthenticated iken tekrar
  // etkinleştirmek loading↔unauthenticated döngüsüyle sonsuz /auth/me isteği üretir.
  useCurrentUser({ enabled: status === 'idle' });

  if (status === 'authenticated') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
