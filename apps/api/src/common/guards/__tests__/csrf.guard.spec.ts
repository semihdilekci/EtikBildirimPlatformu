import { Controller, Get, HttpStatus, Post, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../constants/csrf.constants.js';
import { EnvService } from '../../config/env.service.js';
import { GlobalExceptionFilter } from '../../filters/global-exception.filter.js';
import { CsrfGuard } from '../csrf.guard.js';
import { CsrfService } from '../../services/csrf.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

@Controller()
class TestController {
  @Get('safe')
  safeAction() {
    return { ok: true };
  }

  @Post('mutate')
  mutateAction() {
    return { ok: true };
  }
}

describe('CsrfGuard', () => {
  let app: INestApplication;
  let csrfService: CsrfService;

  afterEach(async () => {
    await app.close();
  });

  async function createApp(): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        CsrfService,
        {
          provide: EnvService,
          useValue: {
            csrfSecret: 'test-csrf-secret-minimum-32-characters-long',
            isProduction: false,
          },
        },
        {
          provide: APP_GUARD,
          useClass: CsrfGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    csrfService = moduleRef.get(CsrfService);
    app.use(cookieParser());
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));
    await app.init();
  }

  it('mutating istek CSRF tokensız → 403 AUTH_CSRF_INVALID', async () => {
    await createApp();

    const response = await request(app.getHttpServer()).post('/mutate').send({});

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body.error.code).toBe('AUTH_CSRF_INVALID');
    expect(response.body.error.message).toBeDefined();
    expect(response.body.error.timestamp).toBeDefined();
  });

  it('mutating istek eşleşen cookie+header ile geçer', async () => {
    await createApp();
    const token = csrfService.generateToken();

    const response = await request(app.getHttpServer())
      .post('/mutate')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`)
      .set(CSRF_HEADER_NAME, token)
      .send({});

    expect(response.status).toBe(HttpStatus.CREATED);
  });

  it('GET istekleri CSRF doğrulamasından muaf', async () => {
    await createApp();

    const response = await request(app.getHttpServer()).get('/safe');

    expect(response.status).toBe(HttpStatus.OK);
  });
});
