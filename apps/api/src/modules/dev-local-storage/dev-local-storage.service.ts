import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { EnvService } from '../../common/config/env.service.js';
import { LocalObjectStorageAdapter } from '../../storage/local-object-storage.adapter.js';

@Injectable()
export class DevLocalStorageService {
  constructor(
    @Inject(EnvService) private readonly envService: EnvService,
    @Inject(LocalObjectStorageAdapter) private readonly localStorage: LocalObjectStorageAdapter,
  ) {}

  async putObject(storageKey: string, expires: string, content: Buffer): Promise<void> {
    this.assertDevOnly();
    this.assertUploadNotExpired(expires);

    await this.localStorage.putObject({
      storageKey,
      content,
    });
  }

  private assertDevOnly(): void {
    if (this.envService.isProduction) {
      throw new NotFoundException('Kaynak bulunamadı.');
    }

    if (this.envService.objectStorageProvider !== 'local') {
      throw new NotFoundException('Kaynak bulunamadı.');
    }
  }

  private assertUploadNotExpired(expires: string): void {
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      throw new NotFoundException('Kaynak bulunamadı.');
    }
  }
}
