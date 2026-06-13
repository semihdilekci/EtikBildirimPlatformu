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
import { TrackingGuard } from '../tracking.guard.js';
import { SecureMessageService } from '../secure-message.service.js';
import { TrackingController } from '../tracking.controller.js';
import { TrackingService } from '../tracking.service.js';
import { ReportAttachmentService } from '../../intake/report-attachment.service.js';
import {
  TRACKING_CODE_HEADER,
  TRACKING_PASSWORD_HEADER,
  TRACKING_VERIFY_RATE_LIMIT,
} from '../tracking.constants.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

describe('TrackingController integration', () => {
  let app: INestApplication;
  let csrfToken: string;

  beforeAll(async () => {
    const trackingService = {
      verify: vi.fn().mockResolvedValue({
        verified: true,
        reportStatus: 'SUBMITTED',
        hasUnreadMessages: false,
        submittedAt: new Date().toISOString(),
      }),
      getStatus: vi.fn().mockReturnValue({
        trackingCode: 'ETK-TEST-CODE',
        status: 'SUBMITTED',
        statusLabel: 'Alındı',
        submittedAt: new Date().toISOString(),
        lastActivityAt: null,
      }),
    };

    const trackingGuard = {
      canActivate: vi.fn().mockImplementation((context) => {
        const req = context.switchToHttp().getRequest();
        req.trackingReport = {
          reportId: 'report-1',
          trackingCode: 'ETK-TEST-CODE',
          status: 'SUBMITTED',
          submittedAt: new Date(),
          lastActivityAt: null,
          companyId: 'company-1',
        };
        return true;
      }),
    };

    app = await createTrackingTestApp(trackingService, trackingGuard);
    csrfToken = 'test-csrf-token';
  });

  afterAll(async () => {
    await app.close();
  });

  const trackingHeaders = {
    [TRACKING_CODE_HEADER]: 'ETK-ABCD-EFGH',
    [TRACKING_PASSWORD_HEADER]: 'Secret123!',
  };

  it('POST /tracking/verify başarılı yanıtta session cookie (sid) set edilmez', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/tracking/verify')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}`)
      .set(CSRF_HEADER_NAME, csrfToken)
      .set(trackingHeaders);

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data.verified).toBe(true);

    const setCookie = response.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
      expect(setCookie.some((entry) => entry.startsWith('sid='))).toBe(false);
    } else if (typeof setCookie === 'string') {
      expect(setCookie.startsWith('sid=')).toBe(false);
    }
  });

  it('GET /tracking/status guard korumalı minimal yanıt döner', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tracking/status')
      .set(trackingHeaders);

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.data).toMatchObject({
      trackingCode: 'ETK-TEST-CODE',
      status: 'SUBMITTED',
      statusLabel: 'Alındı',
    });
    expect(response.body.data.incidentDescription).toBeUndefined();
  });
});

describe('TrackingController rate limit', () => {
  let app: INestApplication;
  let csrfToken: string;

  beforeAll(async () => {
    const trackingService = {
      verify: vi.fn().mockResolvedValue({
        verified: true,
        reportStatus: 'SUBMITTED',
        hasUnreadMessages: false,
        submittedAt: new Date().toISOString(),
      }),
      getStatus: vi.fn(),
    };

    const trackingGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    };

    app = await createTrackingTestApp(trackingService, trackingGuard);
    csrfToken = 'test-csrf-token';
  });

  afterAll(async () => {
    await app.close();
  });

  const trackingHeaders = {
    [TRACKING_CODE_HEADER]: 'ETK-ABCD-EFGH',
    [TRACKING_PASSWORD_HEADER]: 'Secret123!',
  };

  it('POST /tracking/verify 6. istekte RATE_LIMIT_EXCEEDED döner', async () => {
    const agent = request(app.getHttpServer());

    for (let index = 0; index < TRACKING_VERIFY_RATE_LIMIT.limit; index += 1) {
      const response = await agent
        .post('/api/v1/tracking/verify')
        .set('Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}`)
        .set(CSRF_HEADER_NAME, csrfToken)
        .set(trackingHeaders);

      expect(response.status).toBe(HttpStatus.OK);
    }

    const limited = await agent
      .post('/api/v1/tracking/verify')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}`)
      .set(CSRF_HEADER_NAME, csrfToken)
      .set(trackingHeaders);

    expect(limited.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(limited.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(limited.headers['retry-after']).toBeDefined();
  });
});

async function createTrackingTestApp(
  trackingService: Pick<TrackingService, 'verify' | 'getStatus'>,
  trackingGuard: Pick<TrackingGuard, 'canActivate'>,
): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([
        {
          name: 'default',
          ttl: TRACKING_VERIFY_RATE_LIMIT.ttl,
          limit: TRACKING_VERIFY_RATE_LIMIT.limit,
        },
      ]),
    ],
    controllers: [TrackingController],
    providers: [
      { provide: TrackingService, useValue: trackingService },
      {
        provide: SecureMessageService,
        useValue: {
          listMessages: vi.fn().mockResolvedValue([]),
          sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1', sentAt: new Date().toISOString() }),
        },
      },
      {
        provide: ReportAttachmentService,
        useValue: {
          initiateUpload: vi.fn(),
        },
      },
      { provide: TrackingGuard, useValue: trackingGuard },
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
      {
        provide: APP_GUARD,
        useExisting: TrackingGuard,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));
  await app.init();
  return app;
}
