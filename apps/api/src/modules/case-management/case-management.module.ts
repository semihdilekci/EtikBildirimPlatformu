import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CaseAvailableActionsService } from './case-available-actions.service.js';
import { CaseController } from './case.controller.js';
import { CaseReportDecryptService } from './case-report-decrypt.service.js';
import { CaseService } from './case.service.js';
import { TransitionSideEffects } from './transition/transition.side-effects.js';
import { TransitionService } from './transition/transition.service.js';
import { TransitionValidators } from './transition/transition.validators.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule],
  controllers: [CaseController],
  providers: [
    CaseService,
    CaseReportDecryptService,
    CaseAvailableActionsService,
    TransitionService,
    TransitionValidators,
    TransitionSideEffects,
  ],
  exports: [CaseService, TransitionService],
})
export class CaseManagementModule {}
