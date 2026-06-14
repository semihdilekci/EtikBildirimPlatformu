import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationListItemSchema = z.object({
  id: z.string(),
  templateCode: z.string(),
  title: z.string(),
  body: z.string(),
  caseId: z.string().nullable(),
  taskId: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});

export type NotificationListItem = z.infer<typeof notificationListItemSchema>;

export const notificationPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.null(),
});

export type NotificationPagination = z.infer<typeof notificationPaginationSchema>;

export const listNotificationsResponseSchema = z.object({
  data: z.array(notificationListItemSchema),
  pagination: notificationPaginationSchema,
});

export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;

export const unreadNotificationCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UnreadNotificationCountResponse = z.infer<typeof unreadNotificationCountResponseSchema>;
