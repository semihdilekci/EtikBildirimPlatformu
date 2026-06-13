/** Notification delivery channel — Docs/02 §notification_events */
export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SECURE_REPORTER_MESSAGE: 'SECURE_REPORTER_MESSAGE',
} as const;

export type NotificationChannelCode =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NOTIFICATION_CHANNEL_VALUES = Object.values(
  NotificationChannel,
) as readonly NotificationChannelCode[];
