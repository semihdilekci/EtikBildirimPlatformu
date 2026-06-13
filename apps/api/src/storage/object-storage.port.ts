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

export interface ObjectStoragePort {
  createPresignedPutUrl(params: PresignedPutUrlParams): Promise<PresignedPutUrlResult>;
  getObjectBuffer(storageKey: string): Promise<Buffer>;
}
