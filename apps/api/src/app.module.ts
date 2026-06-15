import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { CommonModule } from './common/common.module.js';
import { EnvModule } from './common/config/env.module.js';
import { EnvService } from './common/config/env.service.js';
import { CORRELATION_ID_HEADER } from './common/interceptors/correlation.interceptor.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { AuditModule } from './audit/audit.module.js';
import { buildPinoRedactPaths } from './audit/redaction.constants.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DevCryptoAuditModule } from './modules/dev-crypto-audit/dev-crypto-audit.module.js';
import { DevLocalStorageModule } from './modules/dev-local-storage/dev-local-storage.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IntakeModule } from './modules/intake/intake.module.js';
import { CaseManagementModule } from './modules/case-management/case-management.module.js';
import { DecisionModule } from './modules/decision/decision.module.js';
import { TaskModule } from './modules/task/task.module.js';
import { DocumentModule } from './modules/document/document.module.js';
import { InAppNotificationModule } from './modules/notification/in-app-notification.module.js';
import { TrackingModule } from './modules/tracking/tracking.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    EnvModule,
    CommonModule,
    ThrottlerModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => [
        {
          name: 'default',
          ttl: 60_000,
          // Dev ortamında OIDC debug denemeleri hızla limit doldurur; prod profili korunur.
          limit: envService.isProduction ? 100 : 1_000,
        },
      ],
    }),
    LoggerModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        pinoHttp: {
          level: envService.logLevel,
          redact: buildPinoRedactPaths(),
          genReqId: (request) => {
            const header = request.headers[CORRELATION_ID_HEADER];
            if (typeof header === 'string' && header.length > 0) {
              return header;
            }
            return randomUUID();
          },
          customProps: (request) => ({
            correlationId:
              typeof request.headers[CORRELATION_ID_HEADER] === 'string'
                ? request.headers[CORRELATION_ID_HEADER]
                : undefined,
          }),
        },
      }),
    }),
    PrismaModule,
    CryptoModule,
    AuditModule,
    NotificationModule,
    HealthModule,
    DevCryptoAuditModule,
    DevLocalStorageModule,
    AuthModule,
    IntakeModule,
    CaseManagementModule,
    DecisionModule,
    TaskModule,
    DocumentModule,
    InAppNotificationModule,
    TrackingModule,
    AdminModule,
    AuthorizationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
