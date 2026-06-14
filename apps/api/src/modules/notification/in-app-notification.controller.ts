import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionCode } from '@ethics/policy';
import { listNotificationsQuerySchema, type ListNotificationsQuery } from '@ethics/dto';
import type { ZodSchema } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { InAppNotificationService } from './in-app-notification.service.js';

const NOTIFICATION_READ_RATE_LIMIT = { limit: 120, ttl: 60_000 } as const;
const NOTIFICATION_MUTATION_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;

@Controller('notifications')
export class InAppNotificationController {
  constructor(
    @Inject(InAppNotificationService)
    private readonly notificationService: InAppNotificationService,
  ) {}

  @RequirePolicy(PermissionCode.NOTIFICATION_LIST)
  @Throttle({ default: NOTIFICATION_READ_RATE_LIMIT })
  @Get()
  async listNotifications(
    @Query(
      createZodValidationPipe(listNotificationsQuerySchema as ZodSchema<ListNotificationsQuery>),
    )
    query: ListNotificationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.listNotifications(user, query);
  }

  @RequirePolicy(PermissionCode.NOTIFICATION_LIST)
  @Throttle({ default: NOTIFICATION_READ_RATE_LIMIT })
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.notificationService.getUnreadCount(user);
    return { data };
  }

  @RequirePolicy(PermissionCode.NOTIFICATION_MARK_READ)
  @Throttle({ default: NOTIFICATION_MUTATION_RATE_LIMIT })
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markNotificationRead(
    @Param('id') notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.notificationService.markNotificationRead(user, notificationId);
  }

  @RequirePolicy(PermissionCode.NOTIFICATION_MARK_READ)
  @Throttle({ default: NOTIFICATION_MUTATION_RATE_LIMIT })
  @Post('mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllNotificationsRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.notificationService.markAllNotificationsRead(user);
  }
}
