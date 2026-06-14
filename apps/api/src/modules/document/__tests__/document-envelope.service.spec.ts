import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { EnvService } from '../../../common/config/env.service.js';
import { CRYPTO_ALGORITHM } from '../../../crypto/crypto.constants.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { DocumentEnvelopeService } from '../document-envelope.service.js';

const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');

function buildEnvService(): EnvService {
  return {
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: Buffer.alloc(32, 0x01).toString('base64'),
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
  } as EnvService;
}

describe('DocumentEnvelopeService', () => {
  let envelopeService: DocumentEnvelopeService;
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService(new LocalKeyManagementAdapter(buildEnvService()));
    envelopeService = new DocumentEnvelopeService(cryptoService);
  });

  it('sealString → openString roundtrip plaintext döndürür', async () => {
    const wrapped = await cryptoService.generateWrappedDocumentDek();
    const metadata = envelopeService.buildEncryptionMetadata(
      wrapped.encryptedDek,
      wrapped.kmsKeyId,
    );

    const sealed = await envelopeService.sealString('on-arastirma.pdf', metadata);
    const opened = await envelopeService.openString(sealed, metadata);

    expect(opened).toBe('on-arastirma.pdf');
    expect(sealed).not.toContain('on-arastirma.pdf');
  });

  it('bozulmuş sealed string openString sırasında CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const wrapped = await cryptoService.generateWrappedDocumentDek();
    const metadata = envelopeService.buildEncryptionMetadata(
      wrapped.encryptedDek,
      wrapped.kmsKeyId,
    );
    const sealed = await envelopeService.sealString('kanit.pdf', metadata);
    const tampered = Buffer.from(sealed, 'base64');
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    await expect(
      envelopeService.openString(tampered.toString('base64'), metadata),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('buildEncryptionMetadata varsayılan algoritma AES-256-GCM kullanır', () => {
    const metadata = envelopeService.buildEncryptionMetadata('dek', 'kms-key');
    expect(metadata.algorithm).toBe(CRYPTO_ALGORITHM);
  });
});
