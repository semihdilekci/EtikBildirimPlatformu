import type { Prisma } from '@prisma/client';

import type { NotificationChannelCode, NotificationEventTypeCode } from '@ethics/shared';

export type NotificationTransactionClient = Prisma.TransactionClient;

export interface PublishNotificationEventInput {
  eventType: NotificationEventTypeCode;
  channel: NotificationChannelCode;
  recipientUserId?: string;
  recipientTrackingCode?: string;
  templateId?: string;
  caseId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishedNotificationEventRecord {
  id: string;
  eventType: NotificationEventTypeCode;
  dispatchStatus: string;
}
