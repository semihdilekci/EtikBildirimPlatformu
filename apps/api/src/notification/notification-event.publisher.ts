import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, NOTIFICATION_DISPATCH_PENDING } from '@ethics/shared';

import { DomainException } from '../common/exceptions/domain.exception.js';
import type {
  NotificationTransactionClient,
  PublishNotificationEventInput,
  PublishedNotificationEventRecord,
} from './notification.types.js';

@Injectable()
export class NotificationEventPublisher {
  async publish(
    tx: NotificationTransactionClient,
    input: PublishNotificationEventInput,
  ): Promise<PublishedNotificationEventRecord> {
    if (input.idempotencyKey) {
      const existing = await tx.notificationEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, eventType: true, dispatchStatus: true },
      });

      if (existing) {
        return {
          id: existing.id,
          eventType: existing.eventType as PublishNotificationEventInput['eventType'],
          dispatchStatus: existing.dispatchStatus,
        };
      }
    }

    try {
      const record = await tx.notificationEvent.create({
        data: {
          eventType: input.eventType,
          channel: input.channel,
          recipientUserId: input.recipientUserId ?? null,
          recipientTrackingCode: input.recipientTrackingCode ?? null,
          templateId: input.templateId ?? null,
          caseId: input.caseId ?? null,
          correlationId: input.correlationId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          metadataJson: input.metadata ? (input.metadata as object) : undefined,
          dispatchStatus: NOTIFICATION_DISPATCH_PENDING,
        },
        select: {
          id: true,
          eventType: true,
          dispatchStatus: true,
        },
      });

      return {
        id: record.id,
        eventType: record.eventType as PublishNotificationEventInput['eventType'],
        dispatchStatus: record.dispatchStatus,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.idempotencyKey
      ) {
        const raced = await tx.notificationEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true, eventType: true, dispatchStatus: true },
        });

        if (raced) {
          return {
            id: raced.id,
            eventType: raced.eventType as PublishNotificationEventInput['eventType'],
            dispatchStatus: raced.dispatchStatus,
          };
        }
      }

      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'Failed to publish notification event.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
