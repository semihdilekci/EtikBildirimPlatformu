export const OBJECT_STORAGE_PORT = Symbol('OBJECT_STORAGE_PORT');

export type PresignedPutUrlParams = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  expiresInSeconds?: number;
};

export type PresignedPutUrlResult = {
  uploadUrl: string;
  expiresAt: Date;
  storageKey: string;
};

export type PresignedGetUrlParams = {
  storageKey: string;
  expiresInSeconds?: number;
  downloadFilename?: string;
  contentType?: string;
};

export type PresignedGetUrlResult = {
  downloadUrl: string;
  expiresAt: Date;
  storageKey: string;
};

export type PutObjectParams = {
  storageKey: string;
  content: Buffer;
  contentType?: string;
};

export interface ObjectStoragePort {
  createPresignedPutUrl(params: PresignedPutUrlParams): Promise<PresignedPutUrlResult>;
  createPresignedGetUrl(params: PresignedGetUrlParams): Promise<PresignedGetUrlResult>;
  putObject(params: PutObjectParams): Promise<void>;
  getObjectBuffer(storageKey: string): Promise<Buffer>;
}
