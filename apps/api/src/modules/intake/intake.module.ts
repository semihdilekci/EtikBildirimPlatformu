import { Module } from '@nestjs/common';

import { AuditModule } from '../../audit/audit.module.js';
import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { CaseReportDecryptService } from '../case-management/case-report-decrypt.service.js';
import { InternalReportController } from './internal-report.controller.js';
import { InternalReportService } from './internal-report.service.js';
import { IntakeController } from './intake.controller.js';
import { IntakeService } from './intake.service.js';
import { ReportAttachmentService } from './report-attachment.service.js';
import { TrackingPasswordService } from './tracking-password.service.js';

@Module({
  imports: [PrismaModule, CryptoModule, AuditModule, StorageModule, AuthorizationModule],
  controllers: [IntakeController, InternalReportController],
  providers: [
    IntakeService,
    TrackingPasswordService,
    ReportAttachmentService,
    InternalReportService,
    CaseReportDecryptService,
  ],
  exports: [IntakeService, TrackingPasswordService, ReportAttachmentService],
})
export class IntakeModule {}
