import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import type { Request } from 'express';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { SessionUserPayload } from '../../../common/types/authenticated-user.type.js';
import { AuthService } from '../auth.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
