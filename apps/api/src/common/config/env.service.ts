import { Injectable } from '@nestjs/common';

import { type EnvConfig, validateEnv } from './env.schema.js';

@Injectable()
export class EnvService {
  readonly config: EnvConfig;

  constructor() {
    this.config = validateEnv(process.env);
  }

  get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.config.NODE_ENV;
  }

  get port(): number {
    return this.config.PORT;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get oidcIssuerUrl(): string {
    return this.config.OIDC_ISSUER_URL;
  }

  get oidcClientId(): string {
    return this.config.OIDC_CLIENT_ID;
  }

  get oidcClientSecret(): string {
    return this.config.OIDC_CLIENT_SECRET;
  }

  get oidcCallbackUrl(): string {
    return this.config.OIDC_CALLBACK_URL;
  }

  get sessionSecret(): string {
    return this.config.SESSION_SECRET;
  }

  get csrfSecret(): string {
    return this.config.CSRF_SECRET;
  }

  get sessionStoreTable(): string {
    return this.config.SESSION_STORE_TABLE;
  }

  get sessionAbsoluteTimeoutMs(): number {
    return this.config.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000;
  }

  get webAppUrl(): string {
    return this.config.WEB_APP_URL;
  }

  get corsAllowedOrigins(): string[] {
    return this.config.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get ipHashPepper(): string {
    return this.config.IP_HASH_PEPPER;
  }

  get bruteForceMaxAttempts(): number {
    return this.config.BRUTE_FORCE_MAX_ATTEMPTS;
  }

  get bruteForceLockoutMinutes(): number {
    return this.config.BRUTE_FORCE_LOCKOUT_MINUTES;
  }

  get logLevel(): EnvConfig['LOG_LEVEL'] {
    return this.config.LOG_LEVEL;
  }
}
