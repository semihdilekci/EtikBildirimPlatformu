import { ErrorCode } from '@ethics/shared';
import { describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';

import { TrackingPasswordService } from '../../intake/tracking-password.service.js';
import { TRACKING_CODE_HEADER, TRACKING_PASSWORD_HEADER } from '../tracking.constants.js';
import { TrackingCredentialService } from '../tracking-credential.service.js';

describe('TrackingCredentialService', () => {
  const trackingPasswordService = {} as TrackingPasswordService;

  function createService(report: Record<string, unknown> | null) {
    const prisma = {
      report: {
        findUnique: vi.fn(() => Promise.resolve(report)),
      },
    };

    return new TrackingCredentialService(prisma as never, trackingPasswordService);
  }

  it('extractCredentials geçerli header döner', () => {
    const service = createService(null);
    const request = {
      headers: {
        [TRACKING_CODE_HEADER]: 'ETK-ABCD-EFGH',
        [TRACKING_PASSWORD_HEADER]: 'Secret123!',
      },
    } as never;

    expect(service.extractCredentials(request)).toEqual({
      trackingCode: 'ETK-ABCD-EFGH',
      password: 'Secret123!',
    });
  });

  it('eksik header → AUTH_INVALID_CREDENTIALS', () => {
    const service = createService(null);
    const request = {
      headers: {
        [TRACKING_CODE_HEADER]: 'ETK-ABCD-EFGH',
      },
    } as never;

    expect(() => service.extractCredentials(request)).toThrow(DomainException);
    try {
      service.extractCredentials(request);
    } catch (error) {
      expect(error).toMatchObject({ code: ErrorCode.AUTH_INVALID_CREDENTIALS });
    }
  });

  it('geçersiz tracking code formatı → AUTH_INVALID_CREDENTIALS', () => {
    const service = createService(null);
    const request = {
      headers: {
        [TRACKING_CODE_HEADER]: 'INVALID',
        [TRACKING_PASSWORD_HEADER]: 'Secret123!',
      },
    } as never;

    expect(() => service.extractCredentials(request)).toThrow(DomainException);
    try {
      service.extractCredentials(request);
    } catch (error) {
      expect(error).toMatchObject({ code: ErrorCode.AUTH_INVALID_CREDENTIALS });
    }
  });

  it('authenticate geçerli parola ile report context döner', async () => {
    const verifyPassword = vi.fn(() => Promise.resolve(true));
    const prisma = {
      report: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'report-1',
            trackingCode: 'ETK-ABCD-EFGH',
            trackingCodePasswordHash: '$argon2id$hash',
            status: 'SUBMITTED',
            submittedAt: new Date('2026-06-01T00:00:00.000Z'),
            lastActivityAt: null,
            companyId: 'company-1',
          }),
        ),
      },
    };

    const service = new TrackingCredentialService(
      prisma as never,
      {
        verifyPassword,
      } as unknown as TrackingPasswordService,
    );

    const result = await service.authenticate('ETK-ABCD-EFGH', 'Secret123!');

    expect(result).toMatchObject({
      reportId: 'report-1',
      trackingCode: 'ETK-ABCD-EFGH',
      status: 'SUBMITTED',
      companyId: 'company-1',
    });
    expect(verifyPassword).toHaveBeenCalledWith('Secret123!', '$argon2id$hash');
  });

  it('authenticate bilinmeyen kod → null', async () => {
    const service = createService(null);
    const result = await service.authenticate('ETK-XXXX-YYYY', 'Secret123!');
    expect(result).toBeNull();
  });

  it('authenticate yanlış parola → null', async () => {
    const prisma = {
      report: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'report-1',
            trackingCode: 'ETK-ABCD-EFGH',
            trackingCodePasswordHash: '$argon2id$hash',
            status: 'SUBMITTED',
            submittedAt: new Date(),
            lastActivityAt: null,
            companyId: 'company-1',
          }),
        ),
      },
    };

    const service = new TrackingCredentialService(
      prisma as never,
      {
        verifyPassword: vi.fn(() => Promise.resolve(false)),
      } as unknown as TrackingPasswordService,
    );

    const result = await service.authenticate('ETK-ABCD-EFGH', 'WrongPass1!');
    expect(result).toBeNull();
  });
});
