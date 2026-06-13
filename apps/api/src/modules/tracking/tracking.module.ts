import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuditModule } from '../../audit/audit.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IntakeModule } from '../intake/intake.module.js';
import { TrackingAttemptService } from './tracking-attempt.service.js';
import { SecureMessageService } from './secure-message.service.js';
import { TrackingController } from './tracking.controller.js';
import { TrackingCredentialService } from './tracking-credential.service.js';
import { TrackingGuard } from './tracking.guard.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [PrismaModule, AuditModule, IntakeModule],
  controllers: [TrackingController],
  providers: [
    TrackingAttemptService,
    TrackingCredentialService,
    SecureMessageService,
    TrackingService,
    TrackingGuard,
    {
      provide: APP_GUARD,
      useExisting: TrackingGuard,
    },
  ],
  exports: [
    TrackingService,
    SecureMessageService,
    TrackingAttemptService,
    TrackingCredentialService,
    TrackingGuard,
  ],
})
export class TrackingModule {}
