import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';

import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';

import { EnvService } from '../common/config/env.service.js';
import { DomainException } from '../common/exceptions/domain.exception.js';
import {
  CRYPTO_ALGORITHM,
  CRYPTO_AUTH_TAG_LENGTH_BYTES,
  CRYPTO_DEK_LENGTH_BYTES,
  CRYPTO_IV_LENGTH_BYTES,
  LOCAL_DOCUMENT_KEK_ID,
  LOCAL_FIELD_KEK_ID,
  type KeyPurpose,
} from './crypto.constants.js';
import type { KeyManagementPort } from './key-management.port.js';
import type { WrappedKey } from './crypto.types.js';

function wrapDekWithKek(dek: Buffer, kek: Buffer, kmsKeyId: string): WrappedKey {
  const iv = randomBytes(CRYPTO_IV_LENGTH_BYTES);
  const cipher = createCipheriv(CRYPTO_ALGORITHM, kek, iv) as CipherGCM;
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedDek: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
    kmsKeyId,
  };
}

function unwrapDekWithKek(encryptedDek: string, kek: Buffer): Buffer {
  const buffer = Buffer.from(encryptedDek, 'base64');
  const iv = buffer.subarray(0, CRYPTO_IV_LENGTH_BYTES);
  const authTag = buffer.subarray(
    CRYPTO_IV_LENGTH_BYTES,
    CRYPTO_IV_LENGTH_BYTES + CRYPTO_AUTH_TAG_LENGTH_BYTES,
  );
  const ciphertext = buffer.subarray(CRYPTO_IV_LENGTH_BYTES + CRYPTO_AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(CRYPTO_ALGORITHM, kek, iv) as DecipherGCM;
  decipher.setAuthTag(authTag);
  const dek = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  if (dek.length !== CRYPTO_DEK_LENGTH_BYTES) {
    throw new DomainException(
      ErrorCode.CRYPTO_DECRYPT_FAILED,
      'Unwrapped DEK has invalid length.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return dek;
}

function parseKek(raw: string, envName: string): Buffer {
  const kek = Buffer.from(raw, 'base64');

  if (kek.length !== CRYPTO_DEK_LENGTH_BYTES) {
    throw new DomainException(
      ErrorCode.CRYPTO_INVALID_KEY_CONFIG,
      `${envName} must decode to exactly 32 bytes.`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return kek;
}

export class LocalKeyManagementAdapter implements KeyManagementPort {
  private readonly fieldKek: Buffer;
  private readonly documentKek: Buffer;

  constructor(envService: EnvService) {
    this.fieldKek = parseKek(envService.cryptoLocalKekField, 'CRYPTO_LOCAL_KEK_FIELD');
    this.documentKek = parseKek(envService.cryptoLocalKekDocument, 'CRYPTO_LOCAL_KEK_DOCUMENT');
  }

  wrapKey(dek: Buffer, purpose: KeyPurpose): Promise<WrappedKey> {
    if (dek.length !== CRYPTO_DEK_LENGTH_BYTES) {
      return Promise.reject(
        new DomainException(
          ErrorCode.CRYPTO_INVALID_KEY_CONFIG,
          'DEK must be exactly 32 bytes.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    }

    if (purpose === 'field') {
      return Promise.resolve(wrapDekWithKek(dek, this.fieldKek, LOCAL_FIELD_KEK_ID));
    }

    return Promise.resolve(wrapDekWithKek(dek, this.documentKek, LOCAL_DOCUMENT_KEK_ID));
  }

  unwrapKey(encryptedDek: string, kmsKeyId: string, purpose: KeyPurpose): Promise<Buffer> {
    const expectedKeyId = purpose === 'field' ? LOCAL_FIELD_KEK_ID : LOCAL_DOCUMENT_KEK_ID;

    if (kmsKeyId !== expectedKeyId) {
      return Promise.reject(
        new DomainException(
          ErrorCode.CRYPTO_DECRYPT_FAILED,
          'KMS key id does not match the expected local key.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    }

    const kek = purpose === 'field' ? this.fieldKek : this.documentKek;

    try {
      return Promise.resolve(unwrapDekWithKek(encryptedDek, kek));
    } catch {
      return Promise.reject(
        new DomainException(
          ErrorCode.CRYPTO_DECRYPT_FAILED,
          'Failed to unwrap data encryption key.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    }
  }
}

/**
 * Production AWS KMS adapter — interface-ready stub until Bilgi Güvenliği onaylı KMS erişimi.
 * Swap: CryptoModule factory yalnızca provider değiştirir; servis kodu aynı kalır.
 */
export class KmsKeyManagementAdapter implements KeyManagementPort {
  constructor(private readonly envService: EnvService) {}

  wrapKey(_dek: Buffer, purpose: KeyPurpose): Promise<WrappedKey> {
    try {
      this.assertKmsConfigured(purpose);
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error('KMS configuration assertion failed'),
      );
    }

    return Promise.reject(
      new DomainException(
        ErrorCode.CRYPTO_KMS_UNAVAILABLE,
        'AWS KMS wrap is not configured in this environment.',
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
    );
  }

  unwrapKey(_encryptedDek: string, _kmsKeyId: string, purpose: KeyPurpose): Promise<Buffer> {
    try {
      this.assertKmsConfigured(purpose);
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error('KMS configuration assertion failed'),
      );
    }

    return Promise.reject(
      new DomainException(
        ErrorCode.CRYPTO_KMS_UNAVAILABLE,
        'AWS KMS unwrap is not configured in this environment.',
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
    );
  }

  private assertKmsConfigured(purpose: KeyPurpose): void {
    const alias =
      purpose === 'field'
        ? this.envService.awsKmsKeyAliasField
        : this.envService.awsKmsKeyAliasDocument;

    if (!alias) {
      throw new DomainException(
        ErrorCode.CRYPTO_INVALID_KEY_CONFIG,
        purpose === 'field'
          ? 'AWS_KMS_KEY_ALIAS_FIELD is required when CRYPTO_KEY_MANAGEMENT_PROVIDER=kms.'
          : 'AWS_KMS_KEY_ALIAS_DOCUMENT is required when CRYPTO_KEY_MANAGEMENT_PROVIDER=kms.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
