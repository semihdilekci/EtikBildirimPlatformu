import type { KeyPurpose } from './crypto.constants.js';
import type { WrappedKey } from './crypto.types.js';

export interface KeyManagementPort {
  wrapKey(dek: Buffer, purpose: KeyPurpose): Promise<WrappedKey>;
  unwrapKey(encryptedDek: string, kmsKeyId: string, purpose: KeyPurpose): Promise<Buffer>;
}
