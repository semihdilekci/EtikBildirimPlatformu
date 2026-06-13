import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { SafeLoggerService } from '../../audit/safe-logger.service.js';
import { DomainException } from '../exceptions/domain.exception.js';

type CorrelatedRequest = Request & { correlationId?: string };

interface ValidationDetail {
  field: string;
  rule: string;
  message: string;
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    timestamp: string;
    details?: ValidationDetail[];
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(SafeLoggerService) private readonly safeLogger: SafeLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<CorrelatedRequest>();

    const requestId = request.correlationId ?? 'unknown';
    const timestamp = new Date().toISOString();

    const envelope = this.buildEnvelope(exception, requestId, timestamp);

    if (envelope.status >= 500) {
      this.safeLogger.error(
        {
          correlationId: requestId,
          err: exception instanceof Error ? exception.message : String(exception),
        },
        'Unhandled exception',
      );
    }

    if (envelope.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(envelope.retryAfterSeconds));
    }

    response.status(envelope.status).json(envelope.body);
  }

  private buildEnvelope(
    exception: unknown,
    requestId: string,
    timestamp: string,
  ): { status: number; body: ErrorEnvelope; retryAfterSeconds?: number } {
    if (exception instanceof DomainException) {
      return this.buildDomainEnvelope(exception, requestId, timestamp);
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (this.isDomainPayload(payload)) {
        return {
          status: exception.getStatus(),
          body: {
            error: {
              code: payload.code,
              message: payload.message,
              requestId,
              timestamp,
            },
          },
        };
      }
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        retryAfterSeconds: 60,
        body: {
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Çok fazla istek gönderdiniz.',
            requestId,
            timestamp,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (status === 400) {
        const details = this.extractValidationDetails(payload);
        return {
          status,
          body: {
            error: {
              code: ErrorCode.VALIDATION_FAILED,
              message: 'Formu kontrol edin.',
              requestId,
              timestamp,
              ...(details.length > 0 ? { details } : {}),
            },
          },
        };
      }

      if (this.isDomainPayload(payload)) {
        return {
          status,
          body: {
            error: {
              code: payload.code,
              message: payload.message,
              requestId,
              timestamp,
            },
          },
        };
      }

      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' &&
              'message' in payload &&
              typeof payload.message === 'string'
            ? payload.message
            : 'Bir hata oluştu, lütfen tekrar deneyin.';

      return {
        status,
        body: {
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message,
            requestId,
            timestamp,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Bir hata oluştu, lütfen tekrar deneyin.',
          requestId,
          timestamp,
        },
      },
    };
  }

  private buildDomainEnvelope(
    exception: DomainException,
    requestId: string,
    timestamp: string,
  ): { status: number; body: ErrorEnvelope } {
    const payload = exception.getResponse() as { message: string };
    return {
      status: exception.getStatus(),
      body: {
        error: {
          code: exception.code,
          message: payload.message,
          requestId,
          timestamp,
        },
      },
    };
  }

  private isDomainPayload(payload: unknown): payload is { code: string; message: string } {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'code' in payload &&
      'message' in payload &&
      typeof payload.code === 'string' &&
      typeof payload.message === 'string'
    );
  }

  private extractValidationDetails(payload: string | object): ValidationDetail[] {
    if (typeof payload !== 'object') {
      return [];
    }

    const message = 'message' in payload ? payload.message : undefined;

    if (!Array.isArray(message)) {
      return [];
    }

    return message
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => {
        const [fieldPart, ...rest] = entry.split(' ');
        const field = fieldPart?.replace(/\.$/, '') ?? 'unknown';
        const rule = rest[0] ?? 'invalid';
        return {
          field,
          rule,
          message: entry,
        };
      });
  }
}
