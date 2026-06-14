import { Injectable } from '@nestjs/common';
import {
  NotificationEventType,
  TaskStatus,
  resolveSlaWindowPhase,
  type NotificationEventTypeCode,
  type Role as RoleCode,
} from '@ethics/shared';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { NotificationService } from '../../../notification/notification.service.js';
import {
  listActiveUserIdsByRole,
  toUserRecipients,
} from '../../../notification/notification-recipients.util.js';

export interface SlaReminderClock {
  now(): Date;
}

export interface SlaReminderProcessResult {
  tasksScanned: number;
  warningsCreated: number;
  breachesCreated: number;
}

interface ActiveTaskRecord {
  id: string;
  caseId: string;
  assignedUserId: string | null;
  assignedRole: string;
  dueAt: Date;
  createdAt: Date;
}

@Injectable()
export class SlaReminderHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly clock: SlaReminderClock = { now: () => new Date() },
  ) {}

  async processPendingBatch(): Promise<SlaReminderProcessResult> {
    const now = this.clock.now();
    const nowMs = now.getTime();
    const correlationId = randomUUID();

    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        dueAt: { not: null },
        slaPausedAt: null,
      },
      select: {
        id: true,
        caseId: true,
        assignedUserId: true,
        assignedRole: true,
        dueAt: true,
        createdAt: true,
      },
    });

    let warningsCreated = 0;
    let breachesCreated = 0;

    for (const task of tasks) {
      if (!task.dueAt) {
        continue;
      }

      const activeTask: ActiveTaskRecord = {
        id: task.id,
        caseId: task.caseId,
        assignedUserId: task.assignedUserId,
        assignedRole: task.assignedRole,
        dueAt: task.dueAt,
        createdAt: task.createdAt,
      };

      const phase = resolveSlaWindowPhase(
        { dueAt: activeTask.dueAt, createdAt: activeTask.createdAt },
        nowMs,
      );

      if (phase === 'ON_TRACK') {
        continue;
      }

      const eventType =
        phase === 'OVERDUE' ? NotificationEventType.SLA_BREACH : NotificationEventType.SLA_WARNING;

      const created = await this.enqueueForTask(activeTask, eventType, correlationId);
      if (created) {
        if (eventType === NotificationEventType.SLA_WARNING) {
          warningsCreated += 1;
        } else {
          breachesCreated += 1;
        }
      }
    }

    return {
      tasksScanned: tasks.length,
      warningsCreated,
      breachesCreated,
    };
  }

  private async enqueueForTask(
    task: ActiveTaskRecord,
    eventType: NotificationEventTypeCode,
    correlationId: string,
  ): Promise<boolean> {
    let created = false;

    await this.prisma.$transaction(async (tx) => {
      const recipientIds = await this.resolveAssigneeUserIds(tx, task);
      if (recipientIds.length === 0) {
        return;
      }

      const idempotencyPrefix = `notification:${eventType.toLowerCase()}:task:${task.id}`;
      const existing = await tx.notificationEvent.findFirst({
        where: {
          idempotencyKey: { startsWith: idempotencyPrefix },
        },
        select: { id: true },
      });

      if (existing) {
        return;
      }

      await this.notificationService.enqueue(tx, {
        eventType,
        recipients: toUserRecipients(recipientIds),
        caseId: task.caseId,
        correlationId,
        idempotencyKeyPrefix: idempotencyPrefix,
        metadata: { taskId: task.id },
      });

      created = true;
    });

    return created;
  }

  private async resolveAssigneeUserIds(
    tx: Parameters<NotificationService['enqueue']>[0],
    task: Pick<ActiveTaskRecord, 'assignedUserId' | 'assignedRole'>,
  ): Promise<string[]> {
    if (task.assignedUserId) {
      return [task.assignedUserId];
    }

    return listActiveUserIdsByRole(tx, task.assignedRole as RoleCode);
  }
}
