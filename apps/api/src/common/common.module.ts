import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SafeLoggerService } from '../audit/safe-logger.service.js';
import { EnvModule } from './config/env.module.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';
import { CsrfService } from './services/csrf.service.js';

@Module({
  imports: [EnvModule, AuditModule, PrismaModule],
  providers: [
    CsrfService,
    AuditInterceptor,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_FILTER,
      inject: [SafeLoggerService],
      useFactory: (safeLogger: SafeLoggerService) => new GlobalExceptionFilter(safeLogger),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [CsrfService],
})
export class CommonModule {}
