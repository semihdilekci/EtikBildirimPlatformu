import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import type { Request } from 'express';

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_SAFE_METHODS,
} from '../constants/csrf.constants.js';
import { DomainException } from '../exceptions/domain.exception.js';
import { CsrfService } from '../services/csrf.service.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(CsrfService) private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (CSRF_SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const cookieToken = request.cookies[CSRF_COOKIE_NAME] as string | undefined;
    const headerToken = request.headers[CSRF_HEADER_NAME] as string | undefined;

    if (!this.csrfService.tokensMatch(cookieToken, headerToken)) {
      throw new DomainException(
        ErrorCode.AUTH_CSRF_INVALID,
        'Geçersiz veya eksik CSRF token.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
