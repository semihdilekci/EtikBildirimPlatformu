import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { CRYPTO_ALGORITHM } from '../../crypto/crypto.constants.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import type { DocumentStorageEncryptionMetadata } from '../../crypto/crypto.types.js';

@Injectable()
export class DocumentEnvelopeService {
  constructor(@Inject(CryptoService) private readonly cryptoService: CryptoService) {}

  buildEncryptionMetadata(
    encryptedDek: string,
    kmsKeyId: string,
    algorithm: string = CRYPTO_ALGORITHM,
  ): DocumentStorageEncryptionMetadata {
    return {
      encryptedDek,
      kmsKeyId,
      algorithm: algorithm as DocumentStorageEncryptionMetadata['algorithm'],
    };
  }

  async sealString(
    plaintext: string,
    metadata: DocumentStorageEncryptionMetadata,
  ): Promise<string> {
    const sealed = await this.cryptoService.sealDocumentContent(
      Buffer.from(plaintext, 'utf8'),
      metadata,
    );
    return sealed.toString('base64');
  }

  async openString(
    sealedBase64: string,
    metadata: DocumentStorageEncryptionMetadata,
  ): Promise<string> {
    const plaintext = await this.cryptoService.openDocumentContent(
      Buffer.from(sealedBase64, 'base64'),
      metadata,
    );
    return plaintext.toString('utf8');
  }

  buildDownloadCacheKey(documentId: string, versionNo: number): string {
    return `temp/downloads/${documentId}/v${String(versionNo)}/${randomUUID()}`;
  }
}
