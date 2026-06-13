import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../exceptions/domain.exception.js';
import { GlobalExceptionFilter } from '../global-exception.filter.js';

function createSafeLoggerMock() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

function createHost(request: { correlationId?: string } = {}) {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('GlobalExceptionFilter', () => {
  const safeLogger = createSafeLoggerMock();
  const filter = new GlobalExceptionFilter(safeLogger as never);

  it('DomainException → standart error zarfı', () => {
    const { host, response } = createHost({ correlationId: 'corr-123' });

    filter.catch(
      new DomainException(
        ErrorCode.AUTH_SESSION_REQUIRED,
        'Oturum bulunamadı.',
        HttpStatus.UNAUTHORIZED,
      ),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.AUTH_SESSION_REQUIRED,
        message: 'Oturum bulunamadı.',
        requestId: 'corr-123',
        timestamp: expect.any(String),
      },
    });
  });

  it('ValidationPipe BadRequestException → VALIDATION_FAILED', () => {
    const { host, response } = createHost({ correlationId: 'corr-456' });

    filter.catch(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Formu kontrol edin.',
        requestId: 'corr-456',
        timestamp: expect.any(String),
        details: [
          {
            field: 'email',
            rule: 'must',
            message: 'email must be an email',
          },
        ],
      },
    });
  });

  it('ThrottlerException → RATE_LIMIT_EXCEEDED + Retry-After', () => {
    const { host, response } = createHost();

    filter.catch(new ThrottlerException(), host);

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(response.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(response.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Çok fazla istek gönderdiniz.',
      }),
    });
  });

  it('bilinmeyen hata → INTERNAL_ERROR 500', () => {
    const { host, response } = createHost();

    filter.catch(new Error('unexpected'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: ErrorCode.INTERNAL_ERROR,
      }),
    });
  });
});
