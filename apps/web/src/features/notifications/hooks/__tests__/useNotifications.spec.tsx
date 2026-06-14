import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/api/query-keys';
import {
  useMarkNotificationReadMutation,
  useNotificationsListQuery,
} from '@/features/notifications/hooks/useNotifications';

vi.mock('@/features/notifications/api/notifications.api', () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import {
  fetchNotifications,
  markNotificationRead,
} from '@/features/notifications/api/notifications.api';

const mockedFetchNotifications = vi.mocked(fetchNotifications);
const mockedMarkNotificationRead = vi.mocked(markNotificationRead);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMarkNotificationReadMutation', () => {
  it('should rollback optimistic update when mark-read fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const listFilters = { limit: 20 };
    const initialList = {
      data: [
        {
          id: 'notif-1',
          templateCode: 'task_assigned',
          title: 'Yeni görev',
          body: 'Platforma giriş yapınız',
          caseId: 'case-1',
          taskId: 'task-1',
          isRead: false,
          createdAt: '2026-06-14T10:00:00.000Z',
        },
      ],
      pagination: { nextCursor: null, hasMore: false, total: null },
    };

    queryClient.setQueryData(queryKeys.notifications.list(listFilters), initialList);
    queryClient.setQueryData(queryKeys.notifications.unreadCount(), { count: 1 });

    mockedMarkNotificationRead.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useMarkNotificationReadMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync('notif-1')).rejects.toThrow('network error');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(queryClient.getQueryData(queryKeys.notifications.list(listFilters))).toEqual(
      initialList,
    );
    expect(queryClient.getQueryData(queryKeys.notifications.unreadCount())).toEqual({ count: 1 });
  });
});

describe('useNotificationsListQuery', () => {
  it('should request notifications with unread filter', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockedFetchNotifications.mockResolvedValueOnce({
      data: [],
      pagination: { nextCursor: null, hasMore: false, total: null },
    });

    renderHook(
      () =>
        useNotificationsListQuery({
          limit: 20,
          isRead: false,
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(mockedFetchNotifications).toHaveBeenCalledWith({
        limit: 20,
        isRead: false,
      });
    });
  });
});
