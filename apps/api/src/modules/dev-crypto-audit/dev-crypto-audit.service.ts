import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, AuditEventType, AuditOutcome } from '@ethics/shared';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { EnvService } from '../../common/config/env.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EncryptDemoDto } from './dto/encrypt-demo.dto.js';

export interface EncryptDemoResult {
  auditHandled: true;
  fieldName: 'report_text';
  caseId: string;
  algorithm: string;
  ciphertextLength: number;
}

@Injectable()
export class DevCryptoAuditService {
  constructor(
    private readonly envService: EnvService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly auditPublisher: AuditEventPublisher,
  ) {}

  async encryptDemo(
    user: AuthenticatedUser,
    dto: EncryptDemoDto,
    correlationId: string,
  ): Promise<EncryptDemoResult> {
    this.assertDevOnly();

    return this.prisma.$transaction(async (tx) => {
      const encrypted = await this.cryptoService.encryptField(
        dto.plaintext,
        'report_text',
        dto.caseId,
      );

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'dev_encrypt_demo',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'case',
        resourceId: dto.caseId,
        correlationId,
        metadata: {
          fieldName: 'report_text',
          encrypted: true,
          algorithm: encrypted.algorithm,
        },
        idempotencyKey: `dev-encrypt:${correlationId}`,
      });

      return {
        auditHandled: true as const,
        fieldName: 'report_text' as const,
        caseId: dto.caseId,
        algorithm: encrypted.algorithm,
        ciphertextLength: encrypted.ciphertext.length,
      };
    });
  }

  private assertDevOnly(): void {
    if (this.envService.isProduction) {
      throw new NotFoundException('Kaynak bulunamadı.');
    }
  }
}
