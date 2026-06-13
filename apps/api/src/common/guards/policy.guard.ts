import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ethics/shared';
import type { Request } from 'express';

import { getRequiredPolicy, isPublicRoute } from '../constants/auth-route.metadata.js';
import { DomainException } from '../exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { PolicyGuardService } from '../../authorization/policy-guard.service.js';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PolicyGuardService) private readonly policyGuardService: PolicyGuardService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const permission = getRequiredPolicy(this.reflector, context);
    if (permission === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = this.resolveAuthenticatedUser(request);

    if (!user) {
      throw new DomainException(
        ErrorCode.AUTH_SESSION_REQUIRED,
        'Oturum açmanız gerekiyor.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.policyGuardService.assertAllowed(user, permission);
    return true;
  }

  private resolveAuthenticatedUser(request: Request): AuthenticatedUser | undefined {
    const candidate = request.user as Partial<AuthenticatedUser> | undefined;

    if (candidate === undefined || typeof candidate.id !== 'string') {
      return undefined;
    }

    return candidate as AuthenticatedUser;
  }
}
