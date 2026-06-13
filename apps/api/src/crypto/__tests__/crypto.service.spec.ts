import { Readable } from 'node:stream';

import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvService } from '../../common/config/env.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { CRYPTO_IV_LENGTH_BYTES, LOCAL_FIELD_KEK_ID } from '../crypto.constants.js';
import { CryptoService } from '../crypto.service.js';
import { KmsKeyManagementAdapter, LocalKeyManagementAdapter } from '../key-management.adapter.js';
import type { KeyManagementPort } from '../key-management.port.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');

function buildEnvService(overrides: Partial<EnvService> = {}): EnvService {
  return {
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
    awsKmsKeyAliasField: undefined,
    awsKmsKeyAliasDocument: undefined,
    ...overrides,
  } as EnvService;
}

describe('CryptoService', () => {
  let keyManagement: LocalKeyManagementAdapter;
  let cryptoService: CryptoService;

  beforeEach(() => {
    keyManagement = new LocalKeyManagementAdapter(buildEnvService());
    cryptoService = new CryptoService(keyManagement);
  });

  it('encryptField → decryptField roundtrip plaintext döndürür', async () => {
    const plaintext = 'Gizli bildirim metni — test';

    const encrypted = await cryptoService.encryptField(plaintext, 'report_text', 'case-1');
    const decrypted = await cryptoService.decryptField(encrypted, 'report_text', 'case-1');

    expect(decrypted).toBe(plaintext);
    expect(encrypted.algorithm).toBe('AES-256-GCM');
    expect(encrypted.ciphertext).not.toBe(plaintext);
  });

  it('aynı plaintext için farklı alan şifrelemeleri farklı wrapped DEK üretir', async () => {
    const plaintext = 'Aynı içerik';

    const first = await cryptoService.encryptField(plaintext, 'report_text', 'case-1');
    const second = await cryptoService.encryptField(plaintext, 'incident_description', 'case-1');

    expect(first.encryptedDek).not.toBe(second.encryptedDek);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('encryptDocument → decryptDocument roundtrip stream içeriğini korur', async () => {
    const payload = Buffer.from('PDF veya binary doküman içeriği');

    const encrypted = await cryptoService.encryptDocument(Readable.from(payload), 'doc-1');
    const decryptedStream = await cryptoService.decryptDocument(encrypted);
    const chunks: Buffer[] = [];

    for await (const chunk of decryptedStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks)).toEqual(payload);
    expect(encrypted.documentId).toBe('doc-1');
  });

  it('bozulmuş ciphertext decryptField sırasında CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const encrypted = await cryptoService.encryptField('sensitive', 'report_text', 'case-1');
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from('tampered-data').toString('base64'),
    };

    await expect(
      cryptoService.decryptField(tampered, 'report_text', 'case-1'),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('bozulmuş auth tag decryptField sırasında CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const encrypted = await cryptoService.encryptField('sensitive', 'report_text', 'case-1');
    const buffer = Buffer.from(encrypted.ciphertext, 'base64');
    const tagIndex = CRYPTO_IV_LENGTH_BYTES + 1;
    const tagByte = buffer[tagIndex];
    if (tagByte !== undefined) {
      buffer[tagIndex] = tagByte ^ 0xff;
    }
    const tampered = {
      ...encrypted,
      ciphertext: buffer.toString('base64'),
    };

    await expect(
      cryptoService.decryptField(tampered, 'report_text', 'case-1'),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
    });
  });

  it('desteklenmeyen algorithm decryptField sırasında CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const encrypted = await cryptoService.encryptField('sensitive', 'report_text', 'case-1');

    await expect(
      cryptoService.decryptField(
        { ...encrypted, algorithm: 'AES-128-CBC' as typeof encrypted.algorithm },
        'report_text',
        'case-1',
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
    });
  });

  it('bozulmuş document payload decryptDocument sırasında CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const encrypted = await cryptoService.encryptDocument(
      Readable.from(Buffer.from('doc-content')),
      'doc-1',
    );
    const tampered = {
      ...encrypted,
      encryptedPayload: Buffer.from('tampered-doc').toString('base64'),
    };

    await expect(cryptoService.decryptDocument(tampered)).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
    });
  });

  it('yanlış kmsKeyId ile unwrap CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const encrypted = await cryptoService.encryptField('sensitive', 'report_text', 'case-1');

    await expect(
      cryptoService.decryptField(
        { ...encrypted, kmsKeyId: 'wrong-key-id' },
        'report_text',
        'case-1',
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
    });
  });
});

describe('LocalKeyManagementAdapter', () => {
  it('wrapKey → unwrapKey DEK roundtrip yapar', async () => {
    const adapter = new LocalKeyManagementAdapter(buildEnvService());
    const dek = Buffer.alloc(32, 7);

    const wrapped = await adapter.wrapKey(dek, 'field');
    const unwrapped = await adapter.unwrapKey(wrapped.encryptedDek, wrapped.kmsKeyId, 'field');

    expect(unwrapped).toEqual(dek);
    expect(wrapped.kmsKeyId).toBe('local-field-kek-v1');
  });

  it('field ve document purpose farklı kmsKeyId kullanır', async () => {
    const adapter = new LocalKeyManagementAdapter(buildEnvService());
    const dek = Buffer.alloc(32, 3);

    const fieldWrapped = await adapter.wrapKey(dek, 'field');
    const documentWrapped = await adapter.wrapKey(dek, 'document');

    expect(fieldWrapped.kmsKeyId).toBe('local-field-kek-v1');
    expect(documentWrapped.kmsKeyId).toBe('local-document-kek-v1');
    expect(fieldWrapped.encryptedDek).not.toBe(documentWrapped.encryptedDek);
  });

  it('geçersiz DEK uzunluğu CRYPTO_INVALID_KEY_CONFIG fırlatır', async () => {
    const adapter = new LocalKeyManagementAdapter(buildEnvService());

    await expect(adapter.wrapKey(Buffer.alloc(16), 'field')).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_INVALID_KEY_CONFIG,
    });
  });

  it('yanlış kmsKeyId unwrap CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const adapter = new LocalKeyManagementAdapter(buildEnvService());
    const wrapped = await adapter.wrapKey(Buffer.alloc(32, 9), 'field');

    await expect(
      adapter.unwrapKey(wrapped.encryptedDek, 'wrong-key-id', 'field'),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
    });
  });

  it('bozulmuş wrapped DEK unwrap CRYPTO_DECRYPT_FAILED fırlatır', async () => {
    const adapter = new LocalKeyManagementAdapter(buildEnvService());

    await expect(
      adapter.unwrapKey(
        Buffer.from('tampered-wrap').toString('base64'),
        LOCAL_FIELD_KEK_ID,
        'field',
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_DECRYPT_FAILED,
    });
  });

  it('geçersiz KEK config CRYPTO_INVALID_KEY_CONFIG fırlatır', () => {
    expect(
      () =>
        new LocalKeyManagementAdapter(
          buildEnvService({ cryptoLocalKekField: Buffer.alloc(8).toString('base64') }),
        ),
    ).toThrow(DomainException);
  });
});

describe('KmsKeyManagementAdapter', () => {
  it('wrapKey CRYPTO_KMS_UNAVAILABLE fırlatır (stub)', async () => {
    const adapter = new KmsKeyManagementAdapter(
      buildEnvService({
        cryptoKeyManagementProvider: 'kms',
        awsKmsKeyAliasField: 'alias/ethics-field-key-dev',
        awsKmsKeyAliasDocument: 'alias/ethics-document-key-dev',
      }),
    );

    await expect(adapter.wrapKey(Buffer.alloc(32), 'field')).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_KMS_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('alias eksikse CRYPTO_INVALID_KEY_CONFIG fırlatır', async () => {
    const adapter = new KmsKeyManagementAdapter(buildEnvService());

    await expect(adapter.wrapKey(Buffer.alloc(32), 'field')).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_INVALID_KEY_CONFIG,
    });
  });

  it('unwrapKey stub CRYPTO_KMS_UNAVAILABLE fırlatır', async () => {
    const adapter = new KmsKeyManagementAdapter(
      buildEnvService({
        cryptoKeyManagementProvider: 'kms',
        awsKmsKeyAliasField: 'alias/ethics-field-key-dev',
        awsKmsKeyAliasDocument: 'alias/ethics-document-key-dev',
      }),
    );

    await expect(
      adapter.unwrapKey('wrapped-dek', 'alias/ethics-field-key-dev', 'field'),
    ).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_KMS_UNAVAILABLE,
    });
  });
});

describe('CryptoService with mocked KeyManagementPort', () => {
  it('KMS mock unwrap hatasını decryptField üzerinden iletir', async () => {
    const keyManagement: KeyManagementPort = {
      wrapKey: vi.fn((_dek: Buffer) =>
        Promise.resolve({
          encryptedDek: 'wrapped',
          kmsKeyId: 'mock-kms-key',
        }),
      ),
      unwrapKey: vi.fn(() =>
        Promise.reject(
          new DomainException(
            ErrorCode.CRYPTO_KMS_UNAVAILABLE,
            'KMS unavailable',
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        ),
      ),
    };

    const service = new CryptoService(keyManagement);
    const encrypted = await service.encryptField('test', 'report_text', 'case-1');

    await expect(service.decryptField(encrypted, 'report_text', 'case-1')).rejects.toMatchObject({
      code: ErrorCode.CRYPTO_KMS_UNAVAILABLE,
    });
  });
});
