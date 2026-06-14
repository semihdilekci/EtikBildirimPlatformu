import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventType,
  Role,
  TaskType,
  WorkflowCommand,
  type NotificationEventTypeCode,
  type WorkflowCommandCode,
} from '@ethics/shared';

import { NotificationEventPublisher } from './notification-event.publisher.js';
import {
  dedupeRecipients,
  listActiveUserIdsByRole,
  listCaseStakeholderUserIds,
  toUserRecipients,
  type NotificationRecipientRef,
} from './notification-recipients.util.js';
import {
  resolveTaskAssignedEventType,
  resolveTransitionSupplementalEvents,
} from './notification-transition-events.util.js';
import type { NotificationTransactionClient } from './notification.types.js';
import type {
  CreatedTransitionRecord,
  TransitionTaskStub,
  TransitionValidationContext,
} from '../modules/case-management/transition/transition.types.js';

export interface EnqueueNotificationInput {
  eventType: NotificationEventTypeCode;
  recipients: NotificationRecipientRef[];
  caseId?: string;
  correlationId?: string;
  idempotencyKeyPrefix: string;
  metadata?: Record<string, unknown>;
}

const EMAIL_EXCLUDED_EVENT_TYPES = new Set<NotificationEventTypeCode>([
  NotificationEventType.SECURE_MESSAGE_REPORTER,
  NotificationEventType.SECURE_MESSAGE_RECEIVED,
]);

@Injectable()
export class NotificationService {
  constructor(private readonly publisher: NotificationEventPublisher) {}

  async enqueue(tx: NotificationTransactionClient, input: EnqueueNotificationInput): Promise<void> {
    const recipients = dedupeRecipients(input.recipients);
    if (recipients.length === 0) {
      return;
    }

    for (const recipient of recipients) {
      if (recipient.userId) {
        await this.publisher.publish(tx, {
          eventType: input.eventType,
          channel: NotificationChannel.IN_APP,
          recipientUserId: recipient.userId,
          caseId: input.caseId,
          correlationId: input.correlationId,
          idempotencyKey: `${input.idempotencyKeyPrefix}:in-app:${recipient.userId}`,
          metadata: input.metadata,
        });

        if (this.isEmailAllowed(input.eventType)) {
          await this.publisher.publish(tx, {
            eventType: input.eventType,
            channel: NotificationChannel.EMAIL,
            recipientUserId: recipient.userId,
            caseId: input.caseId,
            correlationId: input.correlationId,
            idempotencyKey: `${input.idempotencyKeyPrefix}:email:${recipient.userId}`,
            metadata: input.metadata,
          });
        }
      }

      if (
        recipient.trackingCode &&
        input.eventType === NotificationEventType.SECURE_MESSAGE_REPORTER
      ) {
        await this.publisher.publish(tx, {
          eventType: input.eventType,
          channel: NotificationChannel.SECURE_REPORTER_MESSAGE,
          recipientTrackingCode: recipient.trackingCode,
          caseId: input.caseId,
          correlationId: input.correlationId,
          idempotencyKey: `${input.idempotencyKeyPrefix}:reporter:${recipient.trackingCode}`,
          metadata: input.metadata,
        });
      }
    }
  }

  async enqueueTransitionNotifications(
    tx: NotificationTransactionClient,
    context: TransitionValidationContext,
    transition: CreatedTransitionRecord,
    tasks: TransitionTaskStub[],
  ): Promise<void> {
    if (!context.idempotencyKey) {
      return;
    }

    const { caseEntity, correlationId, idempotencyKey } = context;
    const baseMetadata = {
      transitionId: transition.id,
      command: transition.command,
      fromState: transition.fromState,
      toState: transition.toState,
    };

    const stakeholders = await listCaseStakeholderUserIds(tx, caseEntity);

    await this.enqueue(tx, {
      eventType: NotificationEventType.CASE_TRANSITION,
      recipients: toUserRecipients(stakeholders),
      caseId: caseEntity.id,
      correlationId,
      idempotencyKeyPrefix: `notification:case-transition:${idempotencyKey}`,
      metadata: baseMetadata,
    });

    for (const eventType of resolveTransitionSupplementalEvents(transition)) {
      const recipients = await this.resolveSupplementalRecipients(
        tx,
        eventType,
        context,
        transition,
        tasks,
        stakeholders,
      );

      await this.enqueue(tx, {
        eventType,
        recipients,
        caseId: caseEntity.id,
        correlationId,
        idempotencyKeyPrefix: `notification:${eventType.toLowerCase()}:${idempotencyKey}`,
        metadata: baseMetadata,
      });
    }

    for (const task of tasks) {
      const assigneeIds = await this.resolveTaskAssigneeUserIds(tx, task);
      const eventType = resolveTaskAssignedEventType(task.taskType);

      await this.enqueue(tx, {
        eventType,
        recipients: toUserRecipients(assigneeIds),
        caseId: caseEntity.id,
        correlationId,
        idempotencyKeyPrefix: `notification:task-assigned:${idempotencyKey}:${task.id}`,
        metadata: {
          ...baseMetadata,
          taskId: task.id,
          taskType: task.taskType,
          assignedRole: task.assignedRole,
        },
      });
    }
  }

  async enqueueTaskCompleted(
    tx: NotificationTransactionClient,
    input: {
      taskId: string;
      caseId: string;
      taskType: string;
      correlationId: string;
      idempotencyKey: string;
      completedByUserId: string;
    },
  ): Promise<void> {
    const secretaryIds = await listActiveUserIdsByRole(tx, Role.COUNCIL_SECRETARY);
    const recipients = secretaryIds.filter((userId) => userId !== input.completedByUserId);

    await this.enqueue(tx, {
      eventType: NotificationEventType.TASK_COMPLETED,
      recipients: toUserRecipients(recipients),
      caseId: input.caseId,
      correlationId: input.correlationId,
      idempotencyKeyPrefix: `notification:task-completed:${input.idempotencyKey}`,
      metadata: {
        taskId: input.taskId,
        taskType: input.taskType,
      },
    });
  }

  async enqueueTaskDelegated(
    tx: NotificationTransactionClient,
    input: {
      taskId: string;
      caseId: string;
      delegateToUserId: string;
      correlationId: string;
      idempotencyKey: string;
    },
  ): Promise<void> {
    await this.enqueue(tx, {
      eventType: NotificationEventType.TASK_DELEGATED,
      recipients: [{ userId: input.delegateToUserId }],
      caseId: input.caseId,
      correlationId: input.correlationId,
      idempotencyKeyPrefix: `notification:task-delegated:${input.idempotencyKey}`,
      metadata: {
        taskId: input.taskId,
      },
    });
  }

  async enqueueSecureMessageReceived(
    tx: NotificationTransactionClient,
    input: {
      caseId: string;
      reportId: string;
      messageId: string;
      trackingCode: string;
      correlationId: string;
      idempotencyKey: string;
    },
  ): Promise<void> {
    const caseEntity = await tx.case.findUniqueOrThrow({
      where: { id: input.caseId },
      select: {
        createdBy: true,
        assignedRapporteurId: true,
        assignedActionOwnerId: true,
      },
    });

    const internalRecipients = await listCaseStakeholderUserIds(tx, caseEntity);

    await this.enqueue(tx, {
      eventType: NotificationEventType.SECURE_MESSAGE_RECEIVED,
      recipients: toUserRecipients(internalRecipients),
      caseId: input.caseId,
      correlationId: input.correlationId,
      idempotencyKeyPrefix: `notification:secure-message-internal:${input.idempotencyKey}`,
      metadata: {
        reportId: input.reportId,
        messageId: input.messageId,
      },
    });

    await this.enqueue(tx, {
      eventType: NotificationEventType.SECURE_MESSAGE_REPORTER,
      recipients: [{ trackingCode: input.trackingCode }],
      caseId: input.caseId,
      correlationId: input.correlationId,
      idempotencyKeyPrefix: `notification:secure-message-reporter:${input.idempotencyKey}`,
      metadata: {
        reportId: input.reportId,
        messageId: input.messageId,
      },
    });
  }

  async enqueueSilentAcceptanceCreated(
    tx: NotificationTransactionClient,
    input: {
      caseId: string;
      voterUserId: string;
      correlationId: string;
      idempotencyKey: string;
    },
  ): Promise<void> {
    await this.enqueue(tx, {
      eventType: NotificationEventType.SILENT_ACCEPTANCE_CREATED,
      recipients: [{ userId: input.voterUserId }],
      caseId: input.caseId,
      correlationId: input.correlationId,
      idempotencyKeyPrefix: `notification:silent-acceptance:${input.idempotencyKey}`,
      metadata: {
        voterUserId: input.voterUserId,
      },
    });
  }

  private isEmailAllowed(eventType: NotificationEventTypeCode): boolean {
    return !EMAIL_EXCLUDED_EVENT_TYPES.has(eventType);
  }

  private async resolveTaskAssigneeUserIds(
    tx: NotificationTransactionClient,
    task: TransitionTaskStub,
  ): Promise<string[]> {
    if (task.assignedUserId) {
      return [task.assignedUserId];
    }

    if (task.taskType === TaskType.MEMBER_APPROVAL_TASK) {
      return listActiveUserIdsByRole(tx, Role.COUNCIL_MEMBER);
    }

    return listActiveUserIdsByRole(tx, task.assignedRole as Role);
  }

  private async resolveSupplementalRecipients(
    tx: NotificationTransactionClient,
    eventType: NotificationEventTypeCode,
    context: TransitionValidationContext,
    transition: CreatedTransitionRecord,
    tasks: TransitionTaskStub[],
    stakeholders: string[],
  ): Promise<NotificationRecipientRef[]> {
    const command = transition.command as WorkflowCommandCode;
    const { metadata } = context;

    switch (eventType) {
      case NotificationEventType.RAPPORTEUR_ASSIGNED: {
        const rapporteurUserId =
          typeof metadata?.rapporteurUserId === 'string'
            ? metadata.rapporteurUserId
            : context.caseEntity.assignedRapporteurId;
        return rapporteurUserId ? [{ userId: rapporteurUserId }] : [];
      }
      case NotificationEventType.ACTION_ASSIGNED:
      case NotificationEventType.FOLLOW_UP_REASSIGNED: {
        const actionOwnerUserId =
          typeof metadata?.actionOwnerUserId === 'string'
            ? metadata.actionOwnerUserId
            : context.caseEntity.assignedActionOwnerId;
        return actionOwnerUserId ? [{ userId: actionOwnerUserId }] : [];
      }
      case NotificationEventType.DECISION_VOTE_REQUESTED:
      case NotificationEventType.MEMBER_APPROVAL_REQUESTED:
        return toUserRecipients(await listActiveUserIdsByRole(tx, Role.COUNCIL_MEMBER));
      case NotificationEventType.BOARD_APPROVE:
      case NotificationEventType.BOARD_VETO:
        return toUserRecipients(await listActiveUserIdsByRole(tx, Role.COUNCIL_SECRETARY));
      case NotificationEventType.MEMBER_OBJECTION:
        return toUserRecipients(stakeholders);
      case NotificationEventType.ACTION_RESPONSE_SUBMITTED:
      case NotificationEventType.PRE_RESEARCH_COMPLETED:
      case NotificationEventType.CHAIR_GATE_DECISION:
      case NotificationEventType.IMPLEMENTATION_LETTER_READY:
      case NotificationEventType.DECISION_DRAFT_READY:
      case NotificationEventType.CASE_CLOSED:
        return toUserRecipients(stakeholders);
      default:
        if (command === WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL) {
          const firstTask = tasks[0];
          if (firstTask) {
            return toUserRecipients(await this.resolveTaskAssigneeUserIds(tx, firstTask));
          }
        }
        return toUserRecipients(stakeholders);
    }
  }
}
