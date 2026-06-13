import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import passport from 'passport';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

import { AppModule } from './app.module.js';
import { EnvService } from './common/config/env.service.js';
import { createCsrfMiddleware } from './common/middleware/csrf.middleware.js';
import { CsrfService } from './common/services/csrf.service.js';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor.js';
import { createPgSessionStore } from './modules/auth/session/pg-session.store.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1');

  const envService = app.get(EnvService);
  const csrfService = app.get(CsrfService);

  app.use(
    helmet({
      contentSecurityPolicy: envService.isProduction ? undefined : false,
    }),
  );

  app.enableCors({
    origin: envService.corsAllowedOrigins,
    credentials: true,
  });

  app.use(cookieParser());
  app.use(createCsrfMiddleware(csrfService, envService));
  app.use(json({ limit: '1mb' }));

  const sessionMiddleware = createPgSessionStore(envService);
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new CorrelationInterceptor());

  await app.listen(envService.port);

  Logger.log(`API listening on port ${String(envService.port)}`, 'Bootstrap');
}

void bootstrap();
