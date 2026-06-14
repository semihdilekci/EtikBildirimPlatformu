import { randomBytes } from 'node:crypto';

import {
  MAX_SINGLE_FILE_BYTES,
  PRESIGNED_DOWNLOAD_TTL_SECONDS,
  PRESIGNED_UPLOAD_TTL_SECONDS,
} from '@ethics/shared';

import type {
  ObjectStoragePort,
  PresignedGetUrlParams,
  PresignedGetUrlResult,
  PresignedPutUrlParams,
  PresignedPutUrlResult,
  PutObjectParams,
} from './object-storage.port.js';

/**
 * Dev/test adapter — presigned URL yerine local PUT endpoint simülasyonu.
 * Worker entegrasyon testleri getObjectBuffer ile dosyayı okur.
 */
export class LocalObjectStorageAdapter implements ObjectStoragePort {
  private readonly objects = new Map<string, Buffer>();

  createPresignedPutUrl(params: PresignedPutUrlParams): Promise<PresignedPutUrlResult> {
    if (params.sizeBytes <= 0 || params.sizeBytes > MAX_SINGLE_FILE_BYTES) {
      throw new Error('Invalid upload size for presigned URL');
    }

    const expiresInSeconds = params.expiresInSeconds ?? PRESIGNED_UPLOAD_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const token = randomBytes(16).toString('hex');

    return Promise.resolve({
      storageKey: params.storageKey,
      expiresAt,
      uploadUrl: `local-storage://put/${encodeURIComponent(params.storageKey)}?token=${token}&expires=${String(expiresAt.getTime())}`,
    });
  }

  createPresignedGetUrl(params: PresignedGetUrlParams): Promise<PresignedGetUrlResult> {
    const expiresInSeconds = params.expiresInSeconds ?? PRESIGNED_DOWNLOAD_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const token = randomBytes(16).toString('hex');
    const filenameQuery = params.downloadFilename
      ? `&filename=${encodeURIComponent(params.downloadFilename)}`
      : '';

    return Promise.resolve({
      storageKey: params.storageKey,
      expiresAt,
      downloadUrl: `local-storage://get/${encodeURIComponent(params.storageKey)}?token=${token}&expires=${String(expiresAt.getTime())}${filenameQuery}`,
    });
  }

  putObject(params: PutObjectParams): Promise<void> {
    this.objects.set(params.storageKey, Buffer.from(params.content));
    return Promise.resolve();
  }

  getObjectBuffer(storageKey: string): Promise<Buffer> {
    const object = this.objects.get(storageKey);
    if (!object) {
      throw new Error(`Object not found: ${storageKey}`);
    }

    return Promise.resolve(object);
  }

  /** Test yardımcısı — client PUT simülasyonu */
  putObjectForTest(storageKey: string, content: Buffer): void {
    this.objects.set(storageKey, content);
  }

  hasObject(storageKey: string): boolean {
    return this.objects.has(storageKey);
  }
}
