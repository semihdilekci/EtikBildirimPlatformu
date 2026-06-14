import { Role, type Role as RoleCode } from '@ethics/shared';
import type { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

export interface NotificationRecipientRef {
  userId?: string;
  trackingCode?: string;
}

export async function listActiveUserIdsByRole(
  tx: TransactionClient,
  roleCode: RoleCode,
): Promise<string[]> {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      rolesAssigned: {
        some: {
          roleCode,
          isActive: true,
        },
      },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  return users.map((user) => user.id);
}

export async function listCaseStakeholderUserIds(
  tx: TransactionClient,
  caseEntity: {
    createdBy: string;
    assignedRapporteurId: string | null;
    assignedActionOwnerId: string | null;
  },
  excludeUserId?: string | null,
): Promise<string[]> {
  const secretaryIds = await listActiveUserIdsByRole(tx, Role.COUNCIL_SECRETARY);
  const ids = new Set<string>([
    ...secretaryIds,
    caseEntity.createdBy,
    ...(caseEntity.assignedRapporteurId ? [caseEntity.assignedRapporteurId] : []),
    ...(caseEntity.assignedActionOwnerId ? [caseEntity.assignedActionOwnerId] : []),
  ]);

  if (excludeUserId) {
    ids.delete(excludeUserId);
  }

  return [...ids];
}

export function dedupeRecipients(
  recipients: NotificationRecipientRef[],
): NotificationRecipientRef[] {
  const seen = new Set<string>();
  const result: NotificationRecipientRef[] = [];

  for (const recipient of recipients) {
    if (recipient.userId) {
      const key = `user:${recipient.userId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ userId: recipient.userId });
      continue;
    }

    if (recipient.trackingCode) {
      const key = `tracking:${recipient.trackingCode}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ trackingCode: recipient.trackingCode });
    }
  }

  return result;
}

export function toUserRecipients(userIds: string[]): NotificationRecipientRef[] {
  return userIds.map((userId) => ({ userId }));
}
