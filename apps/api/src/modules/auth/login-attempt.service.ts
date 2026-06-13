import { createHash } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';

import { EnvService } from '../../common/config/env.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class LoginAttemptService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EnvService) private readonly envService: EnvService,
  ) {}

  hashIpAddress(ipAddress: string): string {
    return createHash('sha256')
      .update(`${this.envService.ipHashPepper}:${ipAddress}`)
      .digest('hex');
  }

  buildScopeKey(ipAddress: string): string {
    return `oidc:ip:${this.hashIpAddress(ipAddress)}`;
  }

  async assertNotLocked(ipAddress: string): Promise<void> {
    const scopeKey = this.buildScopeKey(ipAddress);
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { scopeKey },
    });

    if (!attempt?.lockedUntil) {
      return;
    }

    if (attempt.lockedUntil.getTime() <= Date.now()) {
      return;
    }

    throw new DomainException(
      ErrorCode.AUTH_BRUTE_FORCE_LOCKED,
      'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async recordFailure(ipAddress: string, userId?: string): Promise<void> {
    const scopeKey = this.buildScopeKey(ipAddress);
    const ipAddressHash = this.hashIpAddress(ipAddress);
    const now = new Date();
    const existing = await this.prisma.loginAttempt.findUnique({
      where: { scopeKey },
    });

    const nextFailedCount = (existing?.failedCount ?? 0) + 1;
    const shouldLock = nextFailedCount >= this.envService.bruteForceMaxAttempts;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + this.envService.bruteForceLockoutMinutes * 60 * 1000)
      : null;

    await this.prisma.loginAttempt.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        ipAddressHash,
        userId: userId ?? null,
        failedCount: nextFailedCount,
        lockedUntil,
        lastAttemptAt: now,
      },
      update: {
        userId: userId ?? existing?.userId ?? null,
        failedCount: nextFailedCount,
        lockedUntil,
        lastAttemptAt: now,
      },
    });
  }

  async recordSuccess(ipAddress: string, userId?: string): Promise<void> {
    const scopeKey = this.buildScopeKey(ipAddress);
    const ipAddressHash = this.hashIpAddress(ipAddress);
    const now = new Date();

    await this.prisma.loginAttempt.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        ipAddressHash,
        userId: userId ?? null,
        failedCount: 0,
        lockedUntil: null,
        lastAttemptAt: now,
      },
      update: {
        userId: userId ?? null,
        failedCount: 0,
        lockedUntil: null,
        lastAttemptAt: now,
      },
    });
  }
}
