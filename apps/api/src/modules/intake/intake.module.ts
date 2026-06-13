import { Module } from '@nestjs/common';

import { AuditModule } from '../../audit/audit.module.js';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { IntakeController } from './intake.controller.js';
import { IntakeService } from './intake.service.js';
import { ReportAttachmentService } from './report-attachment.service.js';
import { TrackingPasswordService } from './tracking-password.service.js';

@Module({
  imports: [PrismaModule, CryptoModule, AuditModule, StorageModule],
  controllers: [IntakeController],
  providers: [IntakeService, TrackingPasswordService, ReportAttachmentService],
  exports: [IntakeService, TrackingPasswordService, ReportAttachmentService],
})
export class IntakeModule {}
