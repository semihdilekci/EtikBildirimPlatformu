import { Module } from '@nestjs/common';

import { EnvModule } from '../../common/config/env.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { DevLocalStorageController } from './dev-local-storage.controller.js';
import { DevLocalStorageService } from './dev-local-storage.service.js';

@Module({
  imports: [EnvModule, StorageModule],
  controllers: [DevLocalStorageController],
  providers: [DevLocalStorageService],
})
export class DevLocalStorageModule {}
