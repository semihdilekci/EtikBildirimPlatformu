import { Navigate, Outlet } from 'react-router-dom';

import { useTrackingAuth } from '@/features/tracking/hooks/useTrackingAuth';

export function TrackingGuard() {
  const { isAuthenticated } = useTrackingAuth();

  if (!isAuthenticated) {
    return <Navigate to="/tracking" replace />;
  }

  return <Outlet />;
}
