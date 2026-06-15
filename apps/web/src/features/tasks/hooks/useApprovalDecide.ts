import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DecideTaskBody } from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import { decideTask } from '@/features/tasks/api/tasks.api';

export function useApprovalDecideMutation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: DecideTaskBody) => decideTask(taskId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all() }),
      ]);
    },
  });
}
