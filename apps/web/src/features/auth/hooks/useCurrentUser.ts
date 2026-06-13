import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '@/api/query-keys';
import { fetchCurrentUser } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ApiError } from '@/types/api.types';

const AUTH_ME_STALE_TIME_MS = 5 * 60 * 1000;

export function useCurrentUser(options?: { enabled?: boolean }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setStatus = useAuthStore((state) => state.setStatus);

  const query = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchCurrentUser,
    staleTime: AUTH_ME_STALE_TIME_MS,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (query.isPending) {
      setStatus('loading');
      return;
    }

    if (query.isError) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    setUser(query.data);
    setStatus('authenticated');
  }, [query.data, query.isError, query.isPending, setStatus, setUser]);

  return query;
}
