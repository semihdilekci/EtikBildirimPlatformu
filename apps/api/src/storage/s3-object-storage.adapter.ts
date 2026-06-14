import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ErrorCode,
  MAX_SINGLE_FILE_BYTES,
  PRESIGNED_DOWNLOAD_TTL_SECONDS,
  PRESIGNED_UPLOAD_TTL_SECONDS,
} from '@ethics/shared';

import { EnvService } from '../common/config/env.service.js';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type {
  ObjectStoragePort,
  PresignedGetUrlParams,
  PresignedGetUrlResult,
  PresignedPutUrlParams,
  PresignedPutUrlResult,
  PutObjectParams,
} from './object-storage.port.js';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(EnvService) private readonly envService: EnvService) {
    this.bucket = this.envService.objectStorageQuarantineBucket;
    this.client = new S3Client({
      region: this.envService.awsRegion,
    });
  }

  async createPresignedPutUrl(params: PresignedPutUrlParams): Promise<PresignedPutUrlResult> {
    if (params.sizeBytes <= 0 || params.sizeBytes > MAX_SINGLE_FILE_BYTES) {
      throw new DomainException(
        ErrorCode.DOCUMENT_SIZE_EXCEEDED,
        'Dosya boyutu limiti aşıldı.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const expiresInSeconds = params.expiresInSeconds ?? PRESIGNED_UPLOAD_TTL_SECONDS;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      storageKey: params.storageKey,
      uploadUrl,
      expiresAt,
    };
  }

  async createPresignedGetUrl(params: PresignedGetUrlParams): Promise<PresignedGetUrlResult> {
    const expiresInSeconds = params.expiresInSeconds ?? PRESIGNED_DOWNLOAD_TTL_SECONDS;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ResponseContentType: params.contentType,
      ResponseContentDisposition: params.downloadFilename
        ? `attachment; filename="${params.downloadFilename.replace(/"/g, '')}"`
        : undefined,
    });

    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      storageKey: params.storageKey,
      downloadUrl,
      expiresAt,
    };
  }

  async putObject(params: PutObjectParams): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.storageKey,
        Body: params.content,
        ContentType: params.contentType,
      }),
    );
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );

    if (!response.Body) {
      throw new Error(`Empty object body for key: ${storageKey}`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}
