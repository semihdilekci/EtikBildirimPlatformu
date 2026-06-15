import { forwardRef, Module } from '@nestjs/common';

import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CaseManagementModule } from '../case-management/case-management.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { UnifiedWorkItemService } from './unified-work-item.service.js';
import { BusinessCalendarService } from './sla/business-calendar.service.js';
import { SlaCalculatorService } from './sla/sla-calculator.service.js';
import { SlaReminderHandler } from './sla/sla-reminder.handler.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    AdminModule,
    forwardRef(() => CaseManagementModule),
  ],
  controllers: [TaskController],
  providers: [
    BusinessCalendarService,
    SlaCalculatorService,
    UnifiedWorkItemService,
    TaskService,
    SlaReminderHandler,
  ],
  exports: [TaskService, UnifiedWorkItemService, SlaReminderHandler],
})
export class TaskModule {}
