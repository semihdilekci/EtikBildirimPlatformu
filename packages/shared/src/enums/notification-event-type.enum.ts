/**
 * Notification event types — Faz 8 tam katalog; MVP stub için workflow geçişleri.
 */
export const NotificationEventType = {
  CASE_TRANSITION: 'CASE_TRANSITION',
} as const;

export type NotificationEventTypeCode =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

export const NOTIFICATION_EVENT_TYPE_VALUES = Object.values(
  NotificationEventType,
) as readonly NotificationEventTypeCode[];
