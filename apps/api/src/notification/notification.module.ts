import { Global, Module } from '@nestjs/common';

import { NotificationEventPublisher } from './notification-event.publisher.js';
import { NotificationService } from './notification.service.js';

@Global()
@Module({
  providers: [NotificationEventPublisher, NotificationService],
  exports: [NotificationEventPublisher, NotificationService],
})
export class NotificationModule {}
