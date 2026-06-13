import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { NotificationChannel, NotificationEventType } from '@ethics/shared';

import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import type { TransitionTaskStub, TransitionValidationContext } from './transition.types.js';

export interface CreatedTransitionRecord {
  id: string;
  fromState: string;
  toState: string;
  command: string;
  transitionedAt: Date;
}

/**
 * Side-effect port — Faz 6'da task oluşturma; Faz 8'de notification dispatch dolar.
 */
export interface TransitionSideEffectPort {
  apply(
    tx: Prisma.TransactionClient,
    context: TransitionValidationContext,
    transition: CreatedTransitionRecord,
  ): Promise<TransitionTaskStub[]>;
}

@Injectable()
export class TransitionSideEffects implements TransitionSideEffectPort {
  constructor(private readonly notificationPublisher: NotificationEventPublisher) {}

  async apply(
    tx: Prisma.TransactionClient,
    context: TransitionValidationContext,
    transition: CreatedTransitionRecord,
  ): Promise<TransitionTaskStub[]> {
    if (context.idempotencyKey) {
      await this.notificationPublisher.publish(tx, {
        eventType: NotificationEventType.CASE_TRANSITION,
        channel: NotificationChannel.IN_APP,
        caseId: context.caseEntity.id,
        correlationId: context.correlationId,
        idempotencyKey: `notification:${context.idempotencyKey}`,
        metadata: {
          transitionId: transition.id,
          command: transition.command,
          fromState: transition.fromState,
          toState: transition.toState,
        },
      });
    }

    return [];
  }
}
