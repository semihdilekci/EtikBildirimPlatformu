import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { EnvService } from '../../../common/config/env.service.js';
import { AuthService } from '../auth.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;

  const envService = {
    webAppUrl: 'http://localhost:5173',
    corsAllowedOrigins: ['http://localhost:5173'],
    oidcIssuerUrl: 'https://accounts.google.com',
  } as EnvService;

  const authService = new AuthService(prisma, envService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('JIT provisioning yeni kullanıcı oluşturur ve rol atamaz', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1',
      email: 'new.user@example.com',
      displayName: 'New User',
      clearanceLevel: 'NORMAL',
      companyId: null,
      isGeneralSecretary: false,
      company: null,
      rolesAssigned: [],
    } as never);

    const result = await authService.provisionUserFromOidc({
      sub: 'oidc-sub-1',
      email: 'new.user@example.com',
      name: 'New User',
    });

    expect(result.jitProvisioned).toBe(true);
    expect(result.rolesAssigned).toEqual([]);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oidcSubjectId: 'oidc-sub-1',
          email: 'new.user@example.com',
        }),
        include: expect.any(Object),
      }),
    );
  });

  it('mevcut kullanıcı için JIT rol atamaz', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-2',
      email: 'existing@example.com',
      displayName: 'Existing User',
      clearanceLevel: 'NORMAL',
      companyId: null,
      isGeneralSecretary: false,
      company: null,
      rolesAssigned: [],
    } as never);

    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user-2',
      email: 'existing@example.com',
      displayName: 'Existing User',
      clearanceLevel: 'NORMAL',
      companyId: null,
      isGeneralSecretary: false,
      company: null,
      rolesAssigned: [],
    } as never);

    const result = await authService.provisionUserFromOidc({
      sub: 'oidc-sub-2',
      email: 'existing@example.com',
      name: 'Existing User',
    });

    expect(result.jitProvisioned).toBe(false);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allowlist dışı returnUrl reddeder', () => {
    expect(() => authService.validateReturnUrl('https://evil.example/phish')).toThrow(
      DomainException,
    );

    try {
      authService.validateReturnUrl('https://evil.example/phish');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).code).toBe(ErrorCode.AUTH_INVALID_RETURN_URL);
      expect((error as DomainException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('allowlist içi returnUrl kabul eder', () => {
    expect(authService.validateReturnUrl('http://localhost:5173/app/dashboard')).toBe(
      'http://localhost:5173/app/dashboard',
    );
  });

  it('loadAuthenticatedUser aktif kullanıcıyı döner', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-3',
      email: 'active@example.com',
      displayName: 'Active User',
      clearanceLevel: 'NORMAL',
      companyId: null,
      isGeneralSecretary: false,
      isActive: true,
      company: null,
      rolesAssigned: [{ roleCode: 'admin' }],
    } as never);

    const user = await authService.loadAuthenticatedUser('user-3');

    expect(user?.email).toBe('active@example.com');
    expect(user?.roles).toEqual(['admin']);
  });

  it('loadAuthenticatedUser pasif kullanıcı için null döner', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-4',
      isActive: false,
    } as never);

    const user = await authService.loadAuthenticatedUser('user-4');

    expect(user).toBeNull();
  });

  it('buildMeResponse sessionExpiresAt ISO string üretir', () => {
    const expiresAt = new Date('2026-06-13T12:00:00.000Z');
    const response = authService.buildMeResponse(
      {
        id: 'user-5',
        email: 'me@example.com',
        displayName: 'Me User',
        roles: [],
        clearanceLevel: 'NORMAL',
        companyId: null,
        companyName: null,
        isGeneralSecretary: false,
      },
      expiresAt,
    );

    expect(response.sessionExpiresAt).toBe('2026-06-13T12:00:00.000Z');
  });

  it('returnUrl verilmezse varsayılan dashboard döner', () => {
    expect(authService.validateReturnUrl(undefined)).toBe('http://localhost:5173/app/dashboard');
  });

  it('geçersiz URL formatı AUTH_INVALID_RETURN_URL reddeder', () => {
    expect(() => authService.validateReturnUrl('not-a-valid-url')).toThrow(DomainException);
  });

  it('buildIdpLogoutUrl kurumsal issuer için logout endpoint döner', () => {
    const corporateEnv = {
      webAppUrl: 'http://localhost:5173',
      corsAllowedOrigins: ['http://localhost:5173'],
      oidcIssuerUrl: 'https://idp.example.com/realms/ethics',
    } as EnvService;
    const corporateAuthService = new AuthService(prisma, corporateEnv);

    expect(corporateAuthService.buildIdpLogoutUrl()).toBe(
      'https://idp.example.com/realms/ethics/logout',
    );
  });

  it('buildIdpLogoutUrl Google issuer için Google logout döner', () => {
    expect(authService.buildIdpLogoutUrl()).toBe('https://accounts.google.com/Logout');
  });
});
