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
      if (error instanceof ApiError && error.status === 429) {
        return failureCount < 3;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex, error) => {
      if (error instanceof ApiError && error.status === 429) {
        return Math.min(15_000 * (attemptIndex + 1), 60_000);
      }
      return 1_000;
    },
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (query.isPending) {
      setStatus('loading');
      return;
    }

    if (query.isError) {
      if (query.error instanceof ApiError && query.error.status === 429) {
        setStatus('loading');
        return;
      }

      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    setUser(query.data);
    setStatus('authenticated');
  }, [query.data, query.error, query.isError, query.isPending, setStatus, setUser]);

  return query;
}
