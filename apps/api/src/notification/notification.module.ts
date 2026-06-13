import { Global, Module } from '@nestjs/common';

import { NotificationEventPublisher } from './notification-event.publisher.js';

@Global()
@Module({
  providers: [NotificationEventPublisher],
  exports: [NotificationEventPublisher],
})
export class NotificationModule {}
