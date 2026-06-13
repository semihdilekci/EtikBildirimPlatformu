import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { fetchTrackingStatus } from '@/features/tracking/api/tracking.api';
import { useTrackingAuth } from '@/features/tracking/hooks/useTrackingAuth';

export function useTrackingStatusQuery() {
  const { credentials } = useTrackingAuth();

  return useQuery({
    queryKey: queryKeys.tracking.status(),
    queryFn: () => {
      if (!credentials) {
        throw new Error('Takip kimlik bilgileri bulunamadı.');
      }

      return fetchTrackingStatus(credentials);
    },
    enabled: credentials !== null,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
