import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { AuditEventType } from '@ethics/shared';
import type { Request } from 'express';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { Authenticated } from '../../common/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DevCryptoAuditService } from './dev-crypto-audit.service.js';
import { EncryptDemoDto } from './dto/encrypt-demo.dto.js';

type CorrelatedRequest = Request & { correlationId?: string };

@Controller('dev/crypto-audit')
@Authenticated()
export class DevCryptoAuditController {
  constructor(
    @Inject(DevCryptoAuditService) private readonly devCryptoAuditService: DevCryptoAuditService,
  ) {}

  /**
   * Faz 3 demo: CryptoService encrypt + fail-closed audit outbox aynı transaction'da.
   * Production'da 404 — yalnızca non-prod smoke test için.
   */
  @Post('encrypt-demo')
  @HttpCode(HttpStatus.OK)
  @AuditAction(AuditEventType.SYSTEM_SETTING_CHANGED, 'dev_encrypt_demo', {
    deferToService: true,
  })
  async encryptDemo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: EncryptDemoDto,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const result = await this.devCryptoAuditService.encryptDemo(user, body, correlationId);

    return { data: result };
  }
}
