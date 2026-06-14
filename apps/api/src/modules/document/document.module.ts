import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../authorization/authorization.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { DocumentCaseController, DocumentDownloadController } from './document.controller.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentEnvelopeService } from './document-envelope.service.js';
import { DocumentService } from './document.service.js';

@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, CryptoModule, StorageModule],
  controllers: [DocumentCaseController, DocumentDownloadController],
  providers: [DocumentService, DocumentAccessService, DocumentEnvelopeService],
  exports: [DocumentService, DocumentAccessService, DocumentEnvelopeService],
})
export class DocumentModule {}
