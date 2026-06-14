import { randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  ErrorCode,
  NOTIFICATION_TEMPLATE_CODE_VALUES,
  NotificationTemplateCode,
  Role,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { InAppNotificationService } from '../in-app-notification.service.js';

describe('In-app notification integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: InAppNotificationService;
  let recipientUser: AuthenticatedUser;
  let otherUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    const prismaService = environment.prisma as unknown as PrismaService;
    service = new InAppNotificationService(prismaService);

    const templateCount = await environment.prisma.notificationTemplate.count();
    expect(templateCount).toBe(NOTIFICATION_TEMPLATE_CODE_VALUES.length);

    recipientUser = await createRoleUser(environment, {
      email: 'notification-recipient@ethics.local',
      oidcSubjectId: 'notification-recipient-oidc',
      role: Role.COUNCIL_SECRETARY,
    });

    otherUser = await createRoleUser(environment, {
      email: 'notification-other@ethics.local',
      oidcSubjectId: 'notification-other-oidc',
      role: Role.COUNCIL_MEMBER,
    });
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function createRoleUser(
    environmentRef: PostgresTestEnvironment,
    input: { email: string; oidcSubjectId: string; role: Role },
  ): Promise<AuthenticatedUser> {
    const user = await environmentRef.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.email,
        oidcSubjectId: input.oidcSubjectId,
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environmentRef.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: input.role,
        assignedBy: user.id,
        reason: 'Notification integration test',
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [input.role],
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };
  }

  it('create → list → mark-read → unread count decrement', async () => {
    const created = await service.createInAppNotification({
      userId: recipientUser.id,
      templateCode: NotificationTemplateCode.TASK_ASSIGNED,
      title: 'Yeni görev atandı',
      body: 'Size yeni bir görev atanmıştır. Detaylar için platforma giriş yapınız.',
      caseId: randomUUID(),
      taskId: randomUUID(),
    });

    const unreadBefore = await service.getUnreadCount(recipientUser);
    expect(unreadBefore.count).toBeGreaterThanOrEqual(1);

    const listed = await service.listNotifications(recipientUser, {
      isRead: false,
      limit: 20,
    });

    expect(listed.data.some((item) => item.id === created.id)).toBe(true);
    expect(listed.data.find((item) => item.id === created.id)).toMatchObject({
      templateCode: NotificationTemplateCode.TASK_ASSIGNED,
      isRead: false,
    });

    await service.markNotificationRead(recipientUser, created.id);

    const unreadAfter = await service.getUnreadCount(recipientUser);
    expect(unreadAfter.count).toBe(unreadBefore.count - 1);

    const readList = await service.listNotifications(recipientUser, {
      isRead: true,
      limit: 20,
    });
    expect(readList.data.some((item) => item.id === created.id)).toBe(true);
  });

  it('mark-all-read tüm okunmamış bildirimleri sıfırlar', async () => {
    await service.createInAppNotification({
      userId: recipientUser.id,
      templateCode: NotificationTemplateCode.SLA_WARNING,
      title: 'SLA uyarısı',
      body: 'Bir görevinizin SLA süresi dolmak üzeredir. Platforma giriş yapınız.',
    });

    await service.markAllNotificationsRead(recipientUser);

    const unread = await service.getUnreadCount(recipientUser);
    expect(unread.count).toBe(0);
  });

  it('negatif: başka kullanıcının bildirimini okundu işaretleme → NOTIFICATION_NOT_FOUND', async () => {
    const created = await service.createInAppNotification({
      userId: recipientUser.id,
      templateCode: NotificationTemplateCode.CASE_TRANSITION,
      title: 'Vaka durumu güncellendi',
      body: 'İlgili vakada durum değişikliği yapılmıştır.',
    });

    await expect(service.markNotificationRead(otherUser, created.id)).rejects.toMatchObject({
      code: ErrorCode.NOTIFICATION_NOT_FOUND,
    });
  });
});
