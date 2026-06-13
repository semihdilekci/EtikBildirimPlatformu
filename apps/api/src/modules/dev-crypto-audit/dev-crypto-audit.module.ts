import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { DevCryptoAuditController } from './dev-crypto-audit.controller.js';
import { DevCryptoAuditService } from './dev-crypto-audit.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [DevCryptoAuditController],
  providers: [DevCryptoAuditService],
})
export class DevCryptoAuditModule {}
