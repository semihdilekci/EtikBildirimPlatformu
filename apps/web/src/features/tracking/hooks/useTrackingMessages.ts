import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { fetchTrackingMessages, sendTrackingMessage } from '@/features/tracking/api/tracking.api';
import { useTrackingAuth } from '@/features/tracking/hooks/useTrackingAuth';

export function useTrackingMessagesQuery() {
  const { credentials } = useTrackingAuth();

  return useQuery({
    queryKey: queryKeys.tracking.messages(),
    queryFn: () => {
      if (!credentials) {
        throw new Error('Takip kimlik bilgileri bulunamadı.');
      }

      return fetchTrackingMessages(credentials);
    },
    enabled: credentials !== null,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useSendTrackingMessageMutation() {
  const queryClient = useQueryClient();
  const { credentials } = useTrackingAuth();

  return useMutation({
    mutationFn: (bodyText: string) => {
      if (!credentials) {
        throw new Error('Takip kimlik bilgileri bulunamadı.');
      }

      return sendTrackingMessage(credentials, bodyText);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tracking.messages() });
    },
  });
}
