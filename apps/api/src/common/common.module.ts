import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { EnvModule } from './config/env.module.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { CsrfService } from './services/csrf.service.js';

@Module({
  imports: [EnvModule],
  providers: [
    CsrfService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [CsrfService],
})
export class CommonModule {}
