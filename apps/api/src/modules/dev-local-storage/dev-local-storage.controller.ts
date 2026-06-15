import { Controller, HttpCode, HttpStatus, Inject, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator.js';
import { DevLocalStorageService } from './dev-local-storage.service.js';

type RawBodyRequest = Request & { body: Buffer };

@Controller('dev/local-storage')
@Public()
export class DevLocalStorageController {
  constructor(
    @Inject(DevLocalStorageService) private readonly devLocalStorageService: DevLocalStorageService,
  ) {}

  /**
   * Dev/test: local-storage:// presigned PUT simülasyonu.
   * Production'da 404 — yalnızca OBJECT_STORAGE_PROVIDER=local için.
   */
  @Put('put')
  @HttpCode(HttpStatus.NO_CONTENT)
  async putObject(
    @Query('storageKey') storageKey: string,
    @Query('expires') expires: string,
    @Req() request: RawBodyRequest,
  ): Promise<void> {
    const decodedKey = decodeURIComponent(storageKey);
    const content = Buffer.isBuffer(request.body) ? request.body : Buffer.from([]);

    await this.devLocalStorageService.putObject(decodedKey, expires, content);
  }
}
