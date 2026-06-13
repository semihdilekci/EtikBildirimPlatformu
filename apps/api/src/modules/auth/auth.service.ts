import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ClearanceLevel,
  ErrorCode,
  Role,
  type ClearanceLevel as ClearanceLevelCode,
  type Role as RoleCode,
} from '@ethics/shared';
import type { AuthMeResponse } from '@ethics/dto';

import { EnvService } from '../../common/config/env.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { OidcProfileClaims, ProvisionedUser } from './types/oidc.types.js';

const ROLE_SET = new Set<string>(Object.values(Role));
const CLEARANCE_SET = new Set<string>(Object.values(ClearanceLevel));

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EnvService) private readonly envService: EnvService,
  ) {}

  validateReturnUrl(returnUrl: string | undefined): string {
    if (!returnUrl) {
      return `${this.envService.webAppUrl}/app/dashboard`;
    }

    let parsed: URL;
    try {
      parsed = new URL(returnUrl);
    } catch {
      throw new DomainException(
        ErrorCode.AUTH_INVALID_RETURN_URL,
        'Geçersiz yönlendirme adresi.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const allowedOrigins = new Set([
      ...this.envService.corsAllowedOrigins,
      this.envService.webAppUrl,
    ]);

    if (!allowedOrigins.has(parsed.origin)) {
      throw new DomainException(
        ErrorCode.AUTH_INVALID_RETURN_URL,
        'Geçersiz yönlendirme adresi.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return parsed.toString();
  }

  async provisionUserFromOidc(claims: OidcProfileClaims): Promise<ProvisionedUser> {
    const existing = await this.prisma.user.findUnique({
      where: { oidcSubjectId: claims.sub },
      include: {
        company: true,
        rolesAssigned: {
          where: { isActive: true },
        },
      },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: new Date(),
          displayName: claims.name ?? existing.displayName,
        },
        include: {
          company: true,
          rolesAssigned: {
            where: { isActive: true },
          },
        },
      });

      return {
        ...updated,
        jitProvisioned: false,
      };
    }

    const created = await this.prisma.user.create({
      data: {
        oidcSubjectId: claims.sub,
        email: claims.email,
        displayName: claims.name ?? claims.email,
        provisionedAt: new Date(),
        lastLoginAt: new Date(),
      },
      include: {
        company: true,
        rolesAssigned: {
          where: { isActive: true },
        },
      },
    });

    return {
      ...created,
      jitProvisioned: true,
    };
  }

  async loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        rolesAssigned: {
          where: { isActive: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return this.toAuthenticatedUser(user);
  }

  buildMeResponse(user: AuthenticatedUser, sessionExpiresAt: Date): AuthMeResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      clearanceLevel: user.clearanceLevel,
      companyId: user.companyId,
      companyName: user.companyName,
      isGeneralSecretary: user.isGeneralSecretary,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    };
  }

  buildIdpLogoutUrl(): string | null {
    const issuer = this.envService.oidcIssuerUrl.replace(/\/$/, '');

    if (issuer.includes('accounts.google.com')) {
      return 'https://accounts.google.com/Logout';
    }

    return `${issuer}/logout`;
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    displayName: string;
    clearanceLevel: string;
    companyId: string | null;
    isGeneralSecretary: boolean;
    company: { name: string } | null;
    rolesAssigned: Array<{ roleCode: string }>;
  }): AuthenticatedUser {
    const roles = user.rolesAssigned
      .map((role) => role.roleCode)
      .filter((roleCode): roleCode is RoleCode => ROLE_SET.has(roleCode));

    const clearanceLevel = CLEARANCE_SET.has(user.clearanceLevel)
      ? (user.clearanceLevel as ClearanceLevelCode)
      : ClearanceLevel.NORMAL;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles,
      clearanceLevel,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      isGeneralSecretary: user.isGeneralSecretary,
    };
  }
}
