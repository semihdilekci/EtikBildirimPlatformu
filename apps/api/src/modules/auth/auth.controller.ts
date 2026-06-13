import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import type { Request, Response } from 'express';
import passport from 'passport';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import type {
  AuthenticatedUser,
  SessionUserPayload,
} from '../../common/types/authenticated-user.type.js';
import { EnvService } from '../../common/config/env.service.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { LoginAttemptService } from './login-attempt.service.js';
import { extractClientIp, resolveSessionExpiresAt } from './utils/request.util.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(LoginAttemptService) private readonly loginAttemptService: LoginAttemptService,
    @Inject(EnvService) private readonly envService: EnvService,
  ) {}

  @Get('oidc/login')
  async oidcLogin(
    @Req() request: Request,
    @Res() response: Response,
    @Query('returnUrl') returnUrl?: string,
  ): Promise<void> {
    const ipAddress = extractClientIp(request);
    await this.loginAttemptService.assertNotLocked(ipAddress);

    request.session.returnUrl = this.authService.validateReturnUrl(returnUrl);

    await new Promise<void>((resolve, reject) => {
      const authenticate = passport.authenticate('openidconnect') as (
        req: Request,
        res: Response,
        next: (error: Error | null) => void,
      ) => void;

      authenticate(request, response, (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  @Get('oidc/callback')
  async oidcCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const ipAddress = extractClientIp(request);

    await new Promise<void>((resolve, reject) => {
      const authenticate = passport.authenticate(
        'openidconnect',
        (error: Error | null, user: SessionUserPayload | false) => {
          if (error || !user) {
            void this.loginAttemptService.recordFailure(ipAddress).finally(() => {
              reject(
                new DomainException(
                  ErrorCode.AUTH_OIDC_FAILED,
                  'OIDC kimlik doğrulama başarısız.',
                  HttpStatus.UNAUTHORIZED,
                ),
              );
            });
            return;
          }

          request.logIn(user, (loginError: Error | undefined) => {
            if (loginError) {
              reject(loginError);
              return;
            }

            void this.loginAttemptService
              .recordSuccess(ipAddress, user.userId)
              .then(() => {
                const returnUrl = request.session.returnUrl;
                delete request.session.returnUrl;

                const callbackUrl = new URL('/auth/callback', this.envService.webAppUrl);
                if (returnUrl) {
                  callbackUrl.searchParams.set('returnUrl', returnUrl);
                }

                response.redirect(callbackUrl.toString());
                resolve();
              })
              .catch(reject);
          });
        },
      ) as (req: Request, res: Response) => void;

      authenticate(request, response);
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const idpLogoutUrl = this.authService.buildIdpLogoutUrl();

    await new Promise<void>((resolve, reject) => {
      request.logout((error: Error | undefined) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error: Error | null | undefined) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    response.clearCookie('sid', {
      path: '/',
      httpOnly: true,
      secure: this.envService.isProduction,
      sameSite: 'strict',
    });

    return {
      data: {
        loggedOut: true as const,
        idpLogoutUrl,
      },
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: Request, @CurrentUser() user: AuthenticatedUser) {
    const sessionExpiresAt = resolveSessionExpiresAt(request);

    return {
      data: this.authService.buildMeResponse(user, sessionExpiresAt),
    };
  }
}
