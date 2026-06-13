export type PresignedPutUrlParams = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  expiresInSeconds?: number;
};

export interface ObjectStoragePort {
  getObjectBuffer(storageKey: string): Promise<Buffer>;
}
