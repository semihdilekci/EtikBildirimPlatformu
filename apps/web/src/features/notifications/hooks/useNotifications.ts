import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListNotificationsQuery, ListNotificationsResponse } from '@ethics/dto';
import { useNavigate } from 'react-router-dom';

import { queryKeys } from '@/api/query-keys';
import { fetchCaseDetail } from '@/features/cases/api/cases.api';
import { isCaseForbiddenError, isCaseNotFoundError } from '@/features/cases/utils/case-error.util';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api/notifications.api';
import { getNotificationTargetPath } from '@/features/notifications/utils/notification-format.util';
import { fetchTaskDetail } from '@/features/tasks/api/tasks.api';
import { useNotificationCenterStore } from '@/stores/useNotificationCenterStore';
import { ApiError } from '@/types/api.types';

const FIFTEEN_SECONDS_MS = 15 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useNotificationsListQuery(
  filters: ListNotificationsQuery,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: () => fetchNotifications(filters),
    staleTime: FIFTEEN_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

export function useUnreadNotificationCountQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: fetchUnreadNotificationCount,
    staleTime: FIFTEEN_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    refetchInterval: THIRTY_SECONDS_MS,
    enabled: options?.enabled ?? true,
  });
}

type NotificationMutationContext = {
  previousLists: Array<[readonly unknown[], ListNotificationsResponse | undefined]>;
  previousUnreadCount: { count: number } | undefined;
};

function snapshotNotificationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  const previousLists = queryClient.getQueriesData<ListNotificationsResponse>({
    queryKey: queryKeys.notifications.all(),
    predicate: (query) => query.queryKey[1] === 'list',
  });
  const previousUnreadCount = queryClient.getQueryData<{ count: number }>(
    queryKeys.notifications.unreadCount(),
  );

  return { previousLists, previousUnreadCount };
}

function applyMarkReadOptimisticUpdate(
  queryClient: ReturnType<typeof useQueryClient>,
  notificationId: string,
) {
  queryClient.setQueriesData<ListNotificationsResponse>(
    {
      queryKey: queryKeys.notifications.all(),
      predicate: (query) => query.queryKey[1] === 'list',
    },
    (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        data: current.data.map((item) =>
          item.id === notificationId ? { ...item, isRead: true } : item,
        ),
      };
    },
  );

  queryClient.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount(), (current) => {
    if (!current) {
      return current;
    }

    return { count: Math.max(0, current.count - 1) };
  });
}

function applyMarkAllReadOptimisticUpdate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.setQueriesData<ListNotificationsResponse>(
    {
      queryKey: queryKeys.notifications.all(),
      predicate: (query) => query.queryKey[1] === 'list',
    },
    (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        data: current.data.map((item) => ({ ...item, isRead: true })),
      };
    },
  );

  queryClient.setQueryData<{ count: number }>(queryKeys.notifications.unreadCount(), {
    count: 0,
  });
}

function rollbackNotificationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  context: NotificationMutationContext | undefined,
) {
  if (!context) {
    return;
  }

  for (const [queryKey, data] of context.previousLists) {
    queryClient.setQueryData(queryKey, data);
  }

  queryClient.setQueryData(queryKeys.notifications.unreadCount(), context.previousUnreadCount);
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
      const context = snapshotNotificationQueries(queryClient);
      applyMarkReadOptimisticUpdate(queryClient, notificationId);
      return context;
    },
    onError: (_error, _notificationId, context) => {
      rollbackNotificationQueries(queryClient, context);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
      const context = snapshotNotificationQueries(queryClient);
      applyMarkAllReadOptimisticUpdate(queryClient);
      return context;
    },
    onError: (_error, _variables, context) => {
      rollbackNotificationQueries(queryClient, context);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

function isResourceAccessDeniedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  return (
    error.status === 403 ||
    error.status === 404 ||
    isCaseForbiddenError(error) ||
    isCaseNotFoundError(error)
  );
}

export function useNotificationNavigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const closeDrawer = useNotificationCenterStore((state) => state.closeDrawer);
  const markReadMutation = useMarkNotificationReadMutation();

  const navigateToNotification = async (
    notification: Parameters<typeof getNotificationTargetPath>[0],
    onAccessDenied: () => void,
  ) => {
    const targetPath = getNotificationTargetPath(notification);

    if (!notification.isRead) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        onAccessDenied();
        return;
      }
    }

    if (!targetPath) {
      return;
    }

    try {
      if (notification.taskId) {
        const taskId = notification.taskId;
        await queryClient.fetchQuery({
          queryKey: queryKeys.tasks.detail(taskId),
          queryFn: () => fetchTaskDetail(taskId),
        });
      } else if (notification.caseId) {
        const caseId = notification.caseId;
        await queryClient.fetchQuery({
          queryKey: queryKeys.cases.detail(caseId),
          queryFn: () => fetchCaseDetail(caseId),
        });
      }

      closeDrawer();
      void navigate(targetPath);
    } catch (error) {
      if (isResourceAccessDeniedError(error)) {
        onAccessDenied();
        return;
      }

      throw error;
    }
  };

  return { navigateToNotification, isMarkingRead: markReadMutation.isPending };
}
