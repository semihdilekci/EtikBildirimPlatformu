import { HttpStatus, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ErrorCode } from '@ethics/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import { CsrfService } from '../../../common/services/csrf.service.js';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../common/constants/csrf.constants.js';
import { IntakeController } from '../intake.controller.js';
import { IntakeService } from '../intake.service.js';
import { ReportAttachmentService } from '../report-attachment.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('IntakeController integration (rate limit)', () => {
  let app: INestApplication;
  let csrfToken: string;

  beforeAll(async () => {
    const intakeService = {
      createReport: vi.fn().mockResolvedValue({
        trackingCode: 'ETK-TEST-CODE',
        submittedAt: new Date().toISOString(),
        message: 'ok',
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60_000,
            limit: 10,
          },
        ]),
      ],
      controllers: [IntakeController],
      providers: [
        { provide: IntakeService, useValue: intakeService },
        {
          provide: ReportAttachmentService,
          useValue: {
            initiateUpload: vi.fn(),
          },
        },
        {
          provide: CsrfService,
          useValue: {
            isValidToken: () => true,
            generateToken: () => 'test-csrf-token',
            tokensMatch: (cookie?: string, header?: string) =>
              cookie === 'test-csrf-token' && header === 'test-csrf-token',
          },
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));
    await app.init();

    csrfToken = 'test-csrf-token';
  });

  afterAll(async () => {
    await app.close();
  });

  const validBody = {
    companyId: 'company-1',
    incidentCountry: 'TUR',
    incidentCity: 'İstanbul',
    categoryGroup: 'ASSET_FINANCIAL',
    categories: ['EMBEZZLEMENT'],
    isUncertainCategory: false,
    incidentDescription: 'Rate limit test olay açıklaması yeterli uzunlukta.',
    incidentIsOngoing: false,
    previouslyReported: false,
    urgentRiskFlag: false,
    involvedPersons: [],
    witnesses: [],
    isAnonymous: true,
    trackingPassword: 'RateLimit1',
    kvkkConsentVersion: '1.0',
  };

  it('POST /intake/reports 11. istekte RATE_LIMIT_EXCEEDED döner', async () => {
    const agent = request(app.getHttpServer());

    for (let index = 0; index < 10; index += 1) {
      const response = await agent
        .post('/api/v1/intake/reports')
        .set('Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}`)
        .set(CSRF_HEADER_NAME, csrfToken)
        .send(validBody);

      expect(response.status).toBe(HttpStatus.CREATED);
    }

    const limited = await agent
      .post('/api/v1/intake/reports')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}`)
      .set(CSRF_HEADER_NAME, csrfToken)
      .send(validBody);

    expect(limited.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(limited.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});
