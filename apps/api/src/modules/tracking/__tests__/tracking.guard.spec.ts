import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, ReportStatus } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REQUIRES_TRACKING_KEY } from '../../../common/constants/tracking-route.metadata.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { TrackingAttemptService } from '../tracking-attempt.service.js';
import { TrackingCredentialService } from '../tracking-credential.service.js';
import { TrackingGuard } from '../tracking.guard.js';

describe('TrackingGuard', () => {
  const trackingCredentialService = {
    extractCredentials: vi.fn(),
    authenticate: vi.fn(),
  } as unknown as TrackingCredentialService;

  const trackingAttemptService = {
    assertNotLocked: vi.fn(),
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
  } as unknown as TrackingAttemptService;

  const reflector = {
    getAllAndOverride: vi.fn(),
  } as unknown as Reflector;

  const guard = new TrackingGuard(reflector, trackingCredentialService, trackingAttemptService);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
    vi.mocked(trackingAttemptService.assertNotLocked).mockResolvedValue(undefined);
  });

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () =>
        function handler() {
          return undefined;
        },
      getClass: () =>
        class TestController {
          readonly marker = true;
        },
    } as unknown as ExecutionContext;
  }

  it('@RequiresTracking olmayan route guard atlanır', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key: unknown) => {
      if (key === REQUIRES_TRACKING_KEY) {
        return false;
      }
      return undefined;
    });

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(trackingCredentialService.extractCredentials).not.toHaveBeenCalled();
  });

  it('yanlış parola AUTH_INVALID_CREDENTIALS reddeder', async () => {
    vi.mocked(trackingCredentialService.extractCredentials).mockReturnValue({
      trackingCode: 'ETK-ABCD-EFGH',
      password: 'wrong',
    });
    vi.mocked(trackingCredentialService.authenticate).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({
          ip: '127.0.0.1',
          headers: {},
        }),
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
    });

    expect(trackingAttemptService.recordFailure).toHaveBeenCalledWith('127.0.0.1', 'ETK-ABCD-EFGH');
  });

  it('geçerli kimlik bilgisi request.trackingReport set eder', async () => {
    const reportContext = {
      reportId: 'report-1',
      trackingCode: 'ETK-ABCD-EFGH',
      status: ReportStatus.SUBMITTED,
      submittedAt: new Date('2026-06-09T14:30:00.000Z'),
      lastActivityAt: null,
      companyId: 'company-1',
    };

    vi.mocked(trackingCredentialService.extractCredentials).mockReturnValue({
      trackingCode: 'ETK-ABCD-EFGH',
      password: 'Secret123!',
    });
    vi.mocked(trackingCredentialService.authenticate).mockResolvedValue(reportContext);

    const request = {
      ip: '127.0.0.1',
      headers: {},
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toMatchObject({ trackingReport: reportContext });
    expect(trackingAttemptService.recordSuccess).toHaveBeenCalledWith('127.0.0.1', 'ETK-ABCD-EFGH');
  });

  it('kilitli hesap AUTH_ACCOUNT_LOCKED reddeder', async () => {
    vi.mocked(trackingCredentialService.extractCredentials).mockReturnValue({
      trackingCode: 'ETK-ABCD-EFGH',
      password: 'Secret123!',
    });
    vi.mocked(trackingAttemptService.assertNotLocked).mockRejectedValue(
      new DomainException(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        'Hesap geçici olarak kilitlendi.',
        HttpStatus.UNAUTHORIZED,
      ),
    );

    await expect(
      guard.canActivate(
        createContext({
          ip: '127.0.0.1',
          headers: {},
        }),
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_ACCOUNT_LOCKED,
    });
  });

  it('x-forwarded-for header IP çözümlemesi kullanılır', async () => {
    const reportContext = {
      reportId: 'report-1',
      trackingCode: 'ETK-ABCD-EFGH',
      status: ReportStatus.SUBMITTED,
      submittedAt: new Date(),
      lastActivityAt: null,
      companyId: 'company-1',
    };

    vi.mocked(trackingCredentialService.extractCredentials).mockReturnValue({
      trackingCode: 'ETK-ABCD-EFGH',
      password: 'Secret123!',
    });
    vi.mocked(trackingCredentialService.authenticate).mockResolvedValue(reportContext);

    const request = {
      ip: '127.0.0.1',
      headers: {
        'x-forwarded-for': '203.0.113.55, 10.0.0.1',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(trackingAttemptService.recordSuccess).toHaveBeenCalledWith(
      '203.0.113.55',
      'ETK-ABCD-EFGH',
    );
  });
});
