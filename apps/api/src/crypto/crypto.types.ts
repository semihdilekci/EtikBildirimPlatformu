import type { CRYPTO_ALGORITHM } from './crypto.constants.js';

export interface EncryptedFieldResult {
  ciphertext: string;
  encryptedDek: string;
  kmsKeyId: string;
  algorithm: typeof CRYPTO_ALGORITHM;
}

export interface EncryptedDocumentResult {
  encryptedPayload: string;
  encryptedDek: string;
  kmsKeyId: string;
  algorithm: typeof CRYPTO_ALGORITHM;
  documentId: string;
}

export interface WrappedKey {
  encryptedDek: string;
  kmsKeyId: string;
}
