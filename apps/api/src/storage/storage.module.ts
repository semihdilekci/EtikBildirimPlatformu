import { Module } from '@nestjs/common';

import { EnvModule } from '../common/config/env.module.js';
import { EnvService } from '../common/config/env.service.js';
import { LocalObjectStorageAdapter } from './local-object-storage.adapter.js';
import { OBJECT_STORAGE_PORT } from './object-storage.port.js';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter.js';

@Module({
  imports: [EnvModule],
  providers: [
    LocalObjectStorageAdapter,
    S3ObjectStorageAdapter,
    {
      provide: OBJECT_STORAGE_PORT,
      inject: [EnvService, LocalObjectStorageAdapter, S3ObjectStorageAdapter],
      useFactory: (
        envService: EnvService,
        localAdapter: LocalObjectStorageAdapter,
        s3Adapter: S3ObjectStorageAdapter,
      ) => {
        if (envService.objectStorageProvider === 's3') {
          return s3Adapter;
        }

        return localAdapter;
      },
    },
  ],
  exports: [OBJECT_STORAGE_PORT, LocalObjectStorageAdapter],
})
export class StorageModule {}
