import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ethics/shared';
import type { Request } from 'express';

import { isPublicRoute, requiresSession } from '../../../common/constants/auth-route.metadata.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { SessionUserPayload } from '../../../common/types/authenticated-user.type.js';
import { AuthService } from '../auth.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    if (!requiresSession(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new DomainException(
        ErrorCode.AUTH_SESSION_REQUIRED,
        'Oturum açmanız gerekiyor.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const sessionUser = request.user as SessionUserPayload;

    if (!sessionUser.userId) {
      throw new DomainException(
        ErrorCode.AUTH_SESSION_REQUIRED,
        'Oturum açmanız gerekiyor.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.authService.loadAuthenticatedUser(sessionUser.userId);
    if (!user) {
      throw new DomainException(
        ErrorCode.AUTH_SESSION_EXPIRED,
        'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    Object.assign(request.user, user);

    return true;
  }
}
