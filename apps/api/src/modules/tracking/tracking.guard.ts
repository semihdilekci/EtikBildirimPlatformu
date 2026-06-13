import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ethics/shared';
import type { Request } from 'express';

import { requiresTrackingAuth } from '../../common/constants/tracking-route.metadata.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { TrackingAttemptService } from './tracking-attempt.service.js';
import { TrackingCredentialService } from './tracking-credential.service.js';

function resolveClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? request.ip ?? 'unknown';
  }

  return request.ip ?? 'unknown';
}

@Injectable()
export class TrackingGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TrackingCredentialService)
    private readonly trackingCredentialService: TrackingCredentialService,
    @Inject(TrackingAttemptService)
    private readonly trackingAttemptService: TrackingAttemptService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!requiresTrackingAuth(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ipAddress = resolveClientIp(request);
    const { trackingCode, password } = this.trackingCredentialService.extractCredentials(request);

    await this.trackingAttemptService.assertNotLocked(ipAddress, trackingCode);

    const reportContext = await this.trackingCredentialService.authenticate(trackingCode, password);
    if (!reportContext) {
      await this.trackingAttemptService.recordFailure(ipAddress, trackingCode);
      throw new DomainException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Takip kodu veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.trackingAttemptService.recordSuccess(ipAddress, trackingCode);
    request.trackingReport = reportContext;

    return true;
  }
}
