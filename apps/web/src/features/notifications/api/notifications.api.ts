import type {
  ListNotificationsQuery,
  ListNotificationsResponse,
  UnreadNotificationCountResponse,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

function buildListQueryParams(
  query: ListNotificationsQuery,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    limit: query.limit,
  };

  if (query.isRead !== undefined) {
    params.isRead = query.isRead;
  }

  if (query.cursor) {
    params.cursor = query.cursor;
  }

  return params;
}

export async function fetchNotifications(
  query: ListNotificationsQuery,
): Promise<ListNotificationsResponse> {
  const response = await apiClient.get<ListNotificationsResponse>('/notifications', {
    params: buildListQueryParams(query),
  });
  return response.data;
}

export async function fetchUnreadNotificationCount(): Promise<UnreadNotificationCountResponse> {
  const response = await apiClient.get<ApiSuccessEnvelope<UnreadNotificationCountResponse>>(
    '/notifications/unread-count',
  );
  return response.data.data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiClient.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/mark-all-read');
}
