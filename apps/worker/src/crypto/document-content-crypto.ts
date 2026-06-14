import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';

import {
  CRYPTO_ALGORITHM,
  CRYPTO_AUTH_TAG_LENGTH_BYTES,
  CRYPTO_DEK_LENGTH_BYTES,
  CRYPTO_IV_LENGTH_BYTES,
  LOCAL_DOCUMENT_KEK_ID,
} from './crypto.constants.js';

export interface DocumentEncryptionMetadata {
  encryptedDek: string;
  kmsKeyId: string;
  algorithm: string;
}

export interface WrappedDocumentDek {
  encryptedDek: string;
  kmsKeyId: string;
}

function wrapDekWithKek(dek: Buffer, kek: Buffer): WrappedDocumentDek {
  const iv = randomBytes(CRYPTO_IV_LENGTH_BYTES);
  const cipher = createCipheriv(CRYPTO_ALGORITHM, kek, iv) as CipherGCM;
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedDek: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
    kmsKeyId: LOCAL_DOCUMENT_KEK_ID,
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
    throw new Error('Unwrapped DEK has invalid length.');
  }

  return dek;
}

function decryptBuffer(ciphertextWithMetadata: Buffer, dek: Buffer): Buffer {
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

function encryptBuffer(plaintext: Buffer, dek: Buffer): Buffer {
  const iv = randomBytes(CRYPTO_IV_LENGTH_BYTES);
  const cipher = createCipheriv(CRYPTO_ALGORITHM, dek, iv) as CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

function assertAlgorithm(algorithm: string): void {
  if (algorithm !== CRYPTO_ALGORITHM) {
    throw new Error('Unsupported encryption algorithm.');
  }
}

export class DocumentContentCrypto {
  constructor(private readonly documentKek: Buffer) {}

  generateWrappedDocumentDek(): WrappedDocumentDek {
    const dek = randomBytes(CRYPTO_DEK_LENGTH_BYTES);
    return wrapDekWithKek(dek, this.documentKek);
  }

  buildEncryptionMetadata(
    encryptedDek: string,
    kmsKeyId: string,
    algorithm: string = CRYPTO_ALGORITHM,
  ): DocumentEncryptionMetadata {
    return { encryptedDek, kmsKeyId, algorithm };
  }

  openDocumentContent(encryptedPayload: Buffer, metadata: DocumentEncryptionMetadata): Buffer {
    assertAlgorithm(metadata.algorithm);

    if (metadata.kmsKeyId !== LOCAL_DOCUMENT_KEK_ID) {
      throw new Error('KMS key id does not match the expected local document key.');
    }

    const dek = unwrapDekWithKek(metadata.encryptedDek, this.documentKek);

    try {
      return decryptBuffer(encryptedPayload, dek);
    } catch {
      throw new Error('Failed to decrypt document payload.');
    }
  }

  openString(sealedBase64: string, metadata: DocumentEncryptionMetadata): string {
    const plaintext = this.openDocumentContent(Buffer.from(sealedBase64, 'base64'), metadata);
    return plaintext.toString('utf8');
  }

  sealDocumentContent(plaintext: Buffer, metadata: DocumentEncryptionMetadata): Buffer {
    assertAlgorithm(metadata.algorithm);

    if (metadata.kmsKeyId !== LOCAL_DOCUMENT_KEK_ID) {
      throw new Error('KMS key id does not match the expected local document key.');
    }

    const dek = unwrapDekWithKek(metadata.encryptedDek, this.documentKek);
    return encryptBuffer(plaintext, dek);
  }

  sealString(plaintext: string, metadata: DocumentEncryptionMetadata): string {
    const sealed = this.sealDocumentContent(Buffer.from(plaintext, 'utf8'), metadata);
    return sealed.toString('base64');
  }
}

export function createDocumentContentCryptoFromEnv(): DocumentContentCrypto {
  const raw = process.env.CRYPTO_LOCAL_KEK_DOCUMENT;
  if (!raw) {
    throw new Error('CRYPTO_LOCAL_KEK_DOCUMENT is required for document malware scan worker.');
  }

  const documentKek = Buffer.from(raw, 'base64');
  if (documentKek.length !== CRYPTO_DEK_LENGTH_BYTES) {
    throw new Error('CRYPTO_LOCAL_KEK_DOCUMENT must decode to exactly 32 bytes.');
  }

  return new DocumentContentCrypto(documentKek);
}
