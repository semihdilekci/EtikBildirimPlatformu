import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ErrorCode } from '@ethics/shared';
import OpenIDConnectStrategy from 'passport-openidconnect';
import type { Profile } from 'passport-openidconnect';

import { validateEnv } from '../../../common/config/env.schema.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { AuthService } from '../auth.service.js';

function resolveOidcEndpoints(issuerUrl: string): {
  authorizationURL: string;
  tokenURL: string;
  userInfoURL: string;
} {
  const issuer = issuerUrl.replace(/\/$/, '');

  if (issuer.includes('accounts.google.com')) {
    return {
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://oauth2.googleapis.com/token',
      userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
    };
  }

  return {
    authorizationURL: `${issuer}/authorize`,
    tokenURL: `${issuer}/token`,
    userInfoURL: `${issuer}/userinfo`,
  };
}

@Injectable()
export class OidcStrategy extends PassportStrategy(OpenIDConnectStrategy, 'openidconnect') {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    const env = validateEnv(process.env);
    const endpoints = resolveOidcEndpoints(env.OIDC_ISSUER_URL);

    super({
      issuer: env.OIDC_ISSUER_URL,
      authorizationURL: endpoints.authorizationURL,
      tokenURL: endpoints.tokenURL,
      userInfoURL: endpoints.userInfoURL,
      clientID: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      callbackURL: env.OIDC_CALLBACK_URL,
      scope: 'openid profile email',
      pkce: true,
      state: true,
    });
  }

  async validate(_issuer: string, profile: Profile): Promise<{ userId: string }> {
    const sub = profile.id;
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName ?? undefined;

    if (!sub || !email) {
      throw new DomainException(
        ErrorCode.AUTH_OIDC_FAILED,
        'OIDC kimlik doğrulama başarısız.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.authService.provisionUserFromOidc({
      sub,
      email,
      name,
    });

    return { userId: user.id };
  }
}
