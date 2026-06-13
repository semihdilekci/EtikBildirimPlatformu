import { forwardRef, Module } from '@nestjs/common';

import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CaseManagementModule } from '../case-management/case-management.module.js';
import { DecisionController } from './decision.controller.js';
import { DecisionService } from './decision.service.js';
import { SilentAcceptanceHandler } from './silent-acceptance.handler.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    CryptoModule,
    forwardRef(() => CaseManagementModule),
  ],
  controllers: [DecisionController],
  providers: [DecisionService, SilentAcceptanceHandler],
  exports: [DecisionService, SilentAcceptanceHandler],
})
export class DecisionModule {}
