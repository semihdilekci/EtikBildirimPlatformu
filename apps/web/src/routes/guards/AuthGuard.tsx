import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ApiError } from '@/types/api.types';

export function AuthGuard() {
  const location = useLocation();
  const { isPending, isError, error } = useCurrentUser();

  if (isPending) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress aria-label="Oturum doğrulanıyor" />
      </Box>
    );
  }

  if (isError) {
    const isUnauthorized = error instanceof ApiError && error.status === 401;
    if (isUnauthorized) {
      const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`);
      return <Navigate to={`/auth/login?returnUrl=${returnUrl}`} replace />;
    }

    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
}
