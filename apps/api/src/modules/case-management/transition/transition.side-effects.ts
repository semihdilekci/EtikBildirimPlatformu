import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Prisma } from '@prisma/client';
import { NotificationChannel, NotificationEventType } from '@ethics/shared';

import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import { lazyProviderToken } from '../../../common/utils/lazy-provider-token.util.js';
import type { DocumentAccessService } from '../../document/document-access.service.js';
import type { TaskService } from '../../task/task.service.js';
import type {
  TransitionTaskStub,
  TransitionValidationContext,
  CreatedTransitionRecord,
} from './transition.types.js';

export type { CreatedTransitionRecord };

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
  private taskServiceRef: TaskService | null = null;
  private documentAccessRef: DocumentAccessService | null = null;

  constructor(
    private readonly notificationPublisher: NotificationEventPublisher,
    private readonly moduleRef: ModuleRef,
  ) {}

  wireTaskServiceForTests(taskService: TaskService): void {
    this.taskServiceRef = taskService;
  }

  wireDocumentAccessServiceForTests(documentAccess: DocumentAccessService): void {
    this.documentAccessRef = documentAccess;
  }

  private get taskService(): TaskService {
    if (this.taskServiceRef) {
      return this.taskServiceRef;
    }

    return this.moduleRef.get(
      lazyProviderToken<TaskService>('../../task/task.service.js', 'TaskService'),
      { strict: false },
    );
  }

  private get documentAccess(): DocumentAccessService {
    if (this.documentAccessRef) {
      return this.documentAccessRef;
    }

    return this.moduleRef.get(
      lazyProviderToken<DocumentAccessService>(
        '../../document/document-access.service.js',
        'DocumentAccessService',
      ),
      { strict: false },
    );
  }

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

    await this.documentAccess.applyTransitionGrants(
      tx,
      context.caseEntity.id,
      {
        ...transition,
        performedByUserId: context.actor.userId ?? null,
      },
      context.metadata,
    );

    return this.taskService.createTasksForTransition(tx, context.caseEntity, transition, {
      type: context.actor.type,
      userId: context.actor.userId ?? null,
    });
  }
}
