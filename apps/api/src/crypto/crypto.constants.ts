export const KEY_MANAGEMENT_PORT = Symbol('KEY_MANAGEMENT_PORT');

export const CRYPTO_ALGORITHM = 'AES-256-GCM' as const;

export const CRYPTO_IV_LENGTH_BYTES = 12;

export const CRYPTO_AUTH_TAG_LENGTH_BYTES = 16;

export const CRYPTO_DEK_LENGTH_BYTES = 32;

export const LOCAL_FIELD_KEK_ID = 'local-field-kek-v1';

export const LOCAL_DOCUMENT_KEK_ID = 'local-document-kek-v1';

export type KeyPurpose = 'field' | 'document';
