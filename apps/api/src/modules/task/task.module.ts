import { forwardRef, Module } from '@nestjs/common';

import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CaseManagementModule } from '../case-management/case-management.module.js';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { BusinessCalendarService } from './sla/business-calendar.service.js';
import { SlaCalculatorService } from './sla/sla-calculator.service.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, forwardRef(() => CaseManagementModule)],
  controllers: [TaskController],
  providers: [BusinessCalendarService, SlaCalculatorService, TaskService],
  exports: [TaskService],
})
export class TaskModule {}
