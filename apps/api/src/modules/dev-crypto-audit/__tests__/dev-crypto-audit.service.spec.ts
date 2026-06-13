import { HttpStatus, NotFoundException } from '@nestjs/common';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ClearanceLevel,
  ErrorCode,
} from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { EnvService } from '../../../common/config/env.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { CRYPTO_ALGORITHM } from '../../../crypto/crypto.constants.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { DevCryptoAuditService } from '../dev-crypto-audit.service.js';

const testUser: AuthenticatedUser = {
  id: 'dev-user-1',
  email: 'dev@ethics.local',
  displayName: 'Dev User',
  roles: [],
  clearanceLevel: ClearanceLevel.NORMAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

describe('DevCryptoAuditService', () => {
  let service: DevCryptoAuditService;
  let prisma: PrismaService;
  let cryptoService: CryptoService;
  let auditPublisher: AuditEventPublisher;

  beforeEach(() => {
    cryptoService = {
      encryptField: vi.fn().mockResolvedValue({
        ciphertext: 'encrypted-payload-base64',
        encryptedDek: 'wrapped-dek',
        kmsKeyId: 'local-field-kek-v1',
        algorithm: CRYPTO_ALGORITHM,
      }),
    } as unknown as CryptoService;

    auditPublisher = {
      publish: vi.fn().mockResolvedValue({ id: 'outbox-dev-1' }),
    } as unknown as AuditEventPublisher;

    prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
    } as unknown as PrismaService;

    service = new DevCryptoAuditService(
      { isProduction: false } as EnvService,
      prisma,
      cryptoService,
      auditPublisher,
    );
  });

  it('encrypt + audit outbox aynı transaction içinde çalışır', async () => {
    const result = await service.encryptDemo(
      testUser,
      { plaintext: 'Gizli demo metni', caseId: 'case-demo-1' },
      'corr-dev-1',
    );

    expect(result).toMatchObject({
      auditHandled: true,
      fieldName: 'report_text',
      caseId: 'case-demo-1',
      algorithm: CRYPTO_ALGORITHM,
    });
    expect(cryptoService.encryptField).toHaveBeenCalledWith(
      'Gizli demo metni',
      'report_text',
      'case-demo-1',
    );
    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
        actorType: AuditActorType.USER,
        actorId: 'dev-user-1',
        outcome: AuditOutcome.SUCCESS,
        correlationId: 'corr-dev-1',
        metadata: expect.objectContaining({
          fieldName: 'report_text',
          encrypted: true,
        }),
      }),
    );
    expect(auditPublisher.publish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ report_text: expect.any(String) }),
      }),
    );
  });

  it('production ortamında 404 fırlatır', async () => {
    const productionService = new DevCryptoAuditService(
      { isProduction: true } as EnvService,
      prisma,
      cryptoService,
      auditPublisher,
    );

    await expect(
      productionService.encryptDemo(
        testUser,
        { plaintext: 'secret', caseId: 'case-1' },
        'corr-prod',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('audit publish fail → transaction rollback (fail-closed)', async () => {
    vi.mocked(auditPublisher.publish).mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), {
        code: ErrorCode.AUDIT_FORBIDDEN_CONTENT,
        status: HttpStatus.BAD_REQUEST,
      }),
    );

    await expect(
      service.encryptDemo(testUser, { plaintext: 'secret', caseId: 'case-1' }, 'corr-fail'),
    ).rejects.toBeDefined();

    expect(cryptoService.encryptField).toHaveBeenCalled();
  });
});
