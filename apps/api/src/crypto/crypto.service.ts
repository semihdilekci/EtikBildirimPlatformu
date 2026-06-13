import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';
import { Readable } from 'node:stream';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';

import { DomainException } from '../common/exceptions/domain.exception.js';
import {
  CRYPTO_ALGORITHM,
  CRYPTO_AUTH_TAG_LENGTH_BYTES,
  CRYPTO_DEK_LENGTH_BYTES,
  CRYPTO_IV_LENGTH_BYTES,
  KEY_MANAGEMENT_PORT,
} from './crypto.constants.js';
import type { EncryptedDocumentResult, EncryptedFieldResult } from './crypto.types.js';
import type { KeyManagementPort } from './key-management.port.js';

@Injectable()
export class CryptoService {
  constructor(
    @Inject(KEY_MANAGEMENT_PORT)
    private readonly keyManagement: KeyManagementPort,
  ) {}

  async encryptField(
    plaintext: string,
    _fieldName: string,
    _caseId: string,
  ): Promise<EncryptedFieldResult> {
    const dek = randomBytes(CRYPTO_DEK_LENGTH_BYTES);
    const { ciphertext } = this.encryptBuffer(Buffer.from(plaintext, 'utf8'), dek);
    const wrappedDek = await this.keyManagement.wrapKey(dek, 'field');

    return {
      ciphertext: ciphertext.toString('base64'),
      encryptedDek: wrappedDek.encryptedDek,
      kmsKeyId: wrappedDek.kmsKeyId,
      algorithm: CRYPTO_ALGORITHM,
    };
  }

  async decryptField(
    encrypted: EncryptedFieldResult,
    _fieldName: string,
    _caseId: string,
  ): Promise<string> {
    this.assertFieldAlgorithm(encrypted.algorithm);

    const dek = await this.keyManagement.unwrapKey(
      encrypted.encryptedDek,
      encrypted.kmsKeyId,
      'field',
    );

    try {
      const plaintext = this.decryptBuffer(Buffer.from(encrypted.ciphertext, 'base64'), dek);
      return plaintext.toString('utf8');
    } catch {
      throw new DomainException(
        ErrorCode.CRYPTO_DECRYPT_FAILED,
        'Failed to decrypt field value.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Per-document envelope encryption iskeleti — Faz 7 upload akışında genişletilecek.
   */
  async encryptDocument(stream: Readable, documentId: string): Promise<EncryptedDocumentResult> {
    const plaintext = await this.readStream(stream);
    const dek = randomBytes(CRYPTO_DEK_LENGTH_BYTES);
    const { ciphertext } = this.encryptBuffer(plaintext, dek);
    const wrappedDek = await this.keyManagement.wrapKey(dek, 'document');

    return {
      encryptedPayload: ciphertext.toString('base64'),
      encryptedDek: wrappedDek.encryptedDek,
      kmsKeyId: wrappedDek.kmsKeyId,
      algorithm: CRYPTO_ALGORITHM,
      documentId,
    };
  }

  /**
   * Per-document envelope decryption iskeleti — Faz 7 upload akışında genişletilecek.
   */
  async decryptDocument(encrypted: EncryptedDocumentResult): Promise<Readable> {
    this.assertFieldAlgorithm(encrypted.algorithm);

    const dek = await this.keyManagement.unwrapKey(
      encrypted.encryptedDek,
      encrypted.kmsKeyId,
      'document',
    );

    try {
      const plaintext = this.decryptBuffer(Buffer.from(encrypted.encryptedPayload, 'base64'), dek);
      return Readable.from(plaintext);
    } catch {
      throw new DomainException(
        ErrorCode.CRYPTO_DECRYPT_FAILED,
        'Failed to decrypt document payload.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private encryptBuffer(plaintext: Buffer, dek: Buffer): { ciphertext: Buffer } {
    const iv = randomBytes(CRYPTO_IV_LENGTH_BYTES);
    const cipher = createCipheriv(CRYPTO_ALGORITHM, dek, iv) as CipherGCM;
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: Buffer.concat([iv, authTag, encrypted]),
    };
  }

  private decryptBuffer(ciphertextWithMetadata: Buffer, dek: Buffer): Buffer {
    const iv = ciphertextWithMetadata.subarray(0, CRYPTO_IV_LENGTH_BYTES);
    const authTag = ciphertextWithMetadata.subarray(
      CRYPTO_IV_LENGTH_BYTES,
      CRYPTO_IV_LENGTH_BYTES + CRYPTO_AUTH_TAG_LENGTH_BYTES,
    );
    const ciphertext = ciphertextWithMetadata.subarray(
      CRYPTO_IV_LENGTH_BYTES + CRYPTO_AUTH_TAG_LENGTH_BYTES,
    );

    const decipher = createDecipheriv(CRYPTO_ALGORITHM, dek, iv) as DecipherGCM;
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private async readStream(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks);
  }

  private assertFieldAlgorithm(algorithm: string): void {
    if (algorithm !== CRYPTO_ALGORITHM) {
      throw new DomainException(
        ErrorCode.CRYPTO_DECRYPT_FAILED,
        'Unsupported encryption algorithm.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
