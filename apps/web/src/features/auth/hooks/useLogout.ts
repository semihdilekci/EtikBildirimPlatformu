import { authLogoutResponseSchema } from '@ethics/dto';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export function useLogout() {
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiSuccessEnvelope<unknown>>('/auth/logout');
      return authLogoutResponseSchema.parse(response.data.data);
    },
    onSettled: () => {
      clear();
      queryClient.removeQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}
