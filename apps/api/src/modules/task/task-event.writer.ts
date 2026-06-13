import type { AuditActorTypeCode, TaskEventTypeCode } from '@ethics/shared';
import type { Prisma } from '@prisma/client';

export interface RecordTaskEventInput {
  taskId: string;
  eventType: TaskEventTypeCode;
  actorType: AuditActorTypeCode;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordTaskEvent(
  tx: Prisma.TransactionClient,
  input: RecordTaskEventInput,
): Promise<void> {
  await tx.taskEvent.create({
    data: {
      taskId: input.taskId,
      eventType: input.eventType,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      metadataJson: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
