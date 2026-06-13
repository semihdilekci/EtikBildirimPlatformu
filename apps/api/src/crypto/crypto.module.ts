import { Global, Module } from '@nestjs/common';

import { EnvModule } from '../common/config/env.module.js';
import { EnvService } from '../common/config/env.service.js';
import { KEY_MANAGEMENT_PORT } from './crypto.constants.js';
import { CryptoService } from './crypto.service.js';
import { KmsKeyManagementAdapter, LocalKeyManagementAdapter } from './key-management.adapter.js';
import type { KeyManagementPort } from './key-management.port.js';

@Global()
@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: KEY_MANAGEMENT_PORT,
      useFactory: (envService: EnvService): KeyManagementPort => {
        if (envService.cryptoKeyManagementProvider === 'kms') {
          return new KmsKeyManagementAdapter(envService);
        }

        return new LocalKeyManagementAdapter(envService);
      },
      inject: [EnvService],
    },
    CryptoService,
  ],
  exports: [CryptoService],
})
export class CryptoModule {}
