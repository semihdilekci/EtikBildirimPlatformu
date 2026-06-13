import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { verifyTracking } from '@/features/tracking/api/tracking.api';
import { useTrackingAuth } from '@/features/tracking/hooks/useTrackingAuth';
import type { TrackingCredentials } from '@/features/tracking/context/TrackingContext';

export function useTrackingVerify() {
  const navigate = useNavigate();
  const { setCredentials } = useTrackingAuth();

  return useMutation({
    mutationFn: (credentials: TrackingCredentials) => verifyTracking(credentials),
    onSuccess: (data, credentials) => {
      setCredentials(credentials, data.hasUnreadMessages);
      void navigate('/tracking/status', { replace: true });
    },
  });
}
