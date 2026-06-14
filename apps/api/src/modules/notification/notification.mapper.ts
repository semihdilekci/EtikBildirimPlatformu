import type { NotificationListItem } from '@ethics/dto';
import type { Notification } from '@prisma/client';

export function mapNotificationToListItem(notification: Notification): NotificationListItem {
  return {
    id: notification.id,
    templateCode: notification.templateCode,
    title: notification.title,
    body: notification.body,
    caseId: notification.caseId,
    taskId: notification.taskId,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}
