import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ListNotificationsQuery } from '@ethics/dto';
import { ErrorCode, type NotificationTemplateCodeValue } from '@ethics/shared';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { mapNotificationToListItem } from './notification.mapper.js';
import {
  buildNotificationCursorCondition,
  decodeNotificationListCursor,
  encodeNotificationListCursor,
} from './notification-pagination.util.js';

export interface CreateInAppNotificationInput {
  userId: string;
  templateCode: NotificationTemplateCodeValue;
  title: string;
  body: string;
  caseId?: string;
  taskId?: string;
}

@Injectable()
export class InAppNotificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listNotifications(user: AuthenticatedUser, query: ListNotificationsQuery) {
    const limit = query.limit;
    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.cursor) {
      try {
        const cursor = decodeNotificationListCursor(query.cursor);
        Object.assign(where, buildNotificationCursorCondition(cursor));
      } catch {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Geçersiz sayfalama imleci.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows.at(-1);

    return {
      data: pageRows.map(mapNotificationToListItem),
      pagination: {
        nextCursor:
          hasMore && lastRow
            ? encodeNotificationListCursor({
                id: lastRow.id,
                createdAt: lastRow.createdAt.toISOString(),
              })
            : null,
        hasMore,
        total: null,
      },
    };
  }

  async getUnreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    return { count };
  }

  async markNotificationRead(user: AuthenticatedUser, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
      },
      select: { id: true, isRead: true },
    });

    if (!notification) {
      throw new DomainException(
        ErrorCode.NOTIFICATION_NOT_FOUND,
        'Bildirim bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (notification.isRead) {
      return;
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllNotificationsRead(user: AuthenticatedUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async createInAppNotification(input: CreateInAppNotificationInput) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { templateCode: input.templateCode },
      select: { templateCode: true, isActive: true },
    });

    if (!template?.isActive) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bildirim şablonu bulunamadı veya pasif.',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        templateCode: input.templateCode,
        title: input.title,
        body: input.body,
        caseId: input.caseId ?? null,
        taskId: input.taskId ?? null,
      },
    });
  }
}
