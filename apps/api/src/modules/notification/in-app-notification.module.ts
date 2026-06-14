import { Module } from '@nestjs/common';

import { InAppNotificationController } from './in-app-notification.controller.js';
import { InAppNotificationService } from './in-app-notification.service.js';

@Module({
  controllers: [InAppNotificationController],
  providers: [InAppNotificationService],
  exports: [InAppNotificationService],
})
export class InAppNotificationModule {}
