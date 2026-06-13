import type { ObjectStoragePort } from './object-storage.port.js';

export class LocalObjectStorageAdapter implements ObjectStoragePort {
  private readonly objects = new Map<string, Buffer>();

  getObjectBuffer(storageKey: string): Promise<Buffer> {
    const object = this.objects.get(storageKey);
    if (!object) {
      throw new Error(`Object not found: ${storageKey}`);
    }

    return Promise.resolve(object);
  }

  putObject(storageKey: string, content: Buffer): void {
    this.objects.set(storageKey, content);
  }
}

export function createObjectStorageFromEnv(): ObjectStoragePort {
  return new LocalObjectStorageAdapter();
}

export { LocalObjectStorageAdapter as WorkerLocalObjectStorageAdapter };
