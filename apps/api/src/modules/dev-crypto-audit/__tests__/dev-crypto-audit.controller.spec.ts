import 'reflect-metadata';

import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ClearanceLevel } from '@ethics/shared';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DevCryptoAuditController } from '../dev-crypto-audit.controller.js';
import { DevCryptoAuditService } from '../dev-crypto-audit.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

const testUser: AuthenticatedUser = {
  id: 'ctrl-user-1',
  email: 'ctrl@ethics.local',
  displayName: 'Ctrl User',
  roles: [],
  clearanceLevel: ClearanceLevel.NORMAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

describe('DevCryptoAuditController', () => {
  let app: INestApplication;
  const encryptDemo = vi.fn();

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  async function createApp(): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DevCryptoAuditController],
      providers: [
        {
          provide: DevCryptoAuditService,
          useValue: { encryptDemo },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));
    app.use((req: Request & { correlationId?: string }, _res: Response, next: NextFunction) => {
      req.correlationId = 'corr-ctrl-1';
      req.user = testUser;
      next();
    });
    await app.init();
  }

  it('@Authenticated + @AuditAction encrypt-demo endpoint servisi çağırır', async () => {
    encryptDemo.mockResolvedValue({
      auditHandled: true,
      fieldName: 'report_text',
      caseId: 'case-ctrl-1',
      algorithm: 'AES-256-GCM',
      ciphertextLength: 42,
    });

    await createApp();

    const response = await request(app.getHttpServer())
      .post('/dev/crypto-audit/encrypt-demo')
      .send({ plaintext: 'demo', caseId: 'case-ctrl-1' });

    expect(response.status).toBe(HttpStatus.OK);
    expect(encryptDemo).toHaveBeenCalledWith(
      testUser,
      { plaintext: 'demo', caseId: 'case-ctrl-1' },
      'corr-ctrl-1',
    );
    expect(response.body.data.auditHandled).toBe(true);
  });

  it('controller Authenticated decorator ile işaretlenmiş', () => {
    const isAuthenticated = Reflect.getMetadata('auth:isAuthenticated', DevCryptoAuditController);
    expect(isAuthenticated).toBe(true);
  });
});
