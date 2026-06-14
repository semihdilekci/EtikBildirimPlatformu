import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompleteTaskBody, DelegateTaskBody, ListTasksQuery } from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  completeTask,
  delegateTask,
  fetchTaskDetail,
  fetchTasks,
} from '@/features/tasks/api/tasks.api';

const THIRTY_SECONDS_MS = 30 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useTasksListQuery(filters: ListTasksQuery) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => fetchTasks(filters),
    staleTime: THIRTY_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    placeholderData: (previous) => previous,
  });
}

export function useTaskDetailQuery(taskId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => fetchTaskDetail(taskId),
    enabled: Boolean(taskId),
    staleTime: 0,
  });
}

export function useCompleteTaskMutation(taskId: string, caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CompleteTaskBody) => completeTask(taskId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.transitions(caseId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
      ]);
    },
  });
}

export function useDelegateTaskMutation(taskId: string, caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: DelegateTaskBody) => delegateTask(taskId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
      ]);
    },
  });
}
