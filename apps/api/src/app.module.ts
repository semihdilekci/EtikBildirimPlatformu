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
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
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
          redact: ['req.headers.authorization', 'req.headers.cookie'],
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
    HealthModule,
    AuthModule,
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
