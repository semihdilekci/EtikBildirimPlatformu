import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { OidcStrategy } from '../strategies/oidc.strategy.js';
import { AuthService } from '../auth.service.js';

describe('OidcStrategy', () => {
  const authService = {
    provisionUserFromOidc: vi.fn(),
  } as unknown as AuthService;

  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/ethics_test',
    OIDC_ISSUER_URL: 'https://accounts.google.com',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_CALLBACK_URL: 'http://localhost:5173/api/v1/auth/oidc/callback',
    SESSION_SECRET: 'test-session-secret-minimum-32-characters-long',
    CSRF_SECRET: 'test-csrf-secret-minimum-32-characters-long',
  } as NodeJS.ProcessEnv;

  let strategy: OidcStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, baseEnv);
    strategy = new OidcStrategy(authService);
  });

  it('kurumsal issuer endpointlerini kullanır', () => {
    Object.assign(process.env, {
      ...baseEnv,
      OIDC_ISSUER_URL: 'https://idp.example.com/realms/ethics',
    });

    const corporateStrategy = new OidcStrategy(authService);
    expect(corporateStrategy).toBeDefined();
  });

  it('eksik OIDC profil bilgisinde AUTH_OIDC_FAILED fırlatır', async () => {
    await expect(strategy.validate('issuer', { id: 'sub-1', emails: [] })).rejects.toMatchObject({
      code: ErrorCode.AUTH_OIDC_FAILED,
    });

    try {
      await strategy.validate('issuer', { id: 'sub-1', emails: [] });
    } catch (error) {
      expect((error as DomainException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('geçerli profilde provisionUserFromOidc çağırır', async () => {
    vi.mocked(authService.provisionUserFromOidc).mockResolvedValue({
      id: 'user-oidc-1',
      jitProvisioned: true,
      rolesAssigned: [],
    } as never);

    const result = await strategy.validate('issuer', {
      id: 'sub-oidc-1',
      emails: [{ value: 'oidc@example.com' }],
      displayName: 'OIDC User',
    });

    expect(result).toEqual({ userId: 'user-oidc-1' });
    expect(authService.provisionUserFromOidc).toHaveBeenCalledWith({
      sub: 'sub-oidc-1',
      email: 'oidc@example.com',
      name: 'OIDC User',
    });
  });
});
