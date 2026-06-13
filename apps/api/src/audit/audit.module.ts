import { Global, Module } from '@nestjs/common';

import { AuditEventPublisher } from './audit-event.publisher.js';
import { AuditSealService } from './audit-seal.service.js';
import { RedactionService } from './redaction.service.js';
import { SafeLoggerService } from './safe-logger.service.js';

@Global()
@Module({
  providers: [AuditEventPublisher, AuditSealService, RedactionService, SafeLoggerService],
  exports: [AuditEventPublisher, AuditSealService, RedactionService, SafeLoggerService],
})
export class AuditModule {}
