import { createHash } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { EnvService } from '../../common/config/env.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type TrackingAttemptLockResult = {
  failedCount: number;
  lockedUntil: Date | null;
  lockoutTriggered: boolean;
};

type AttemptDbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class TrackingAttemptService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EnvService) private readonly envService: EnvService,
  ) {}

  hashIpAddress(ipAddress: string): string {
    return createHash('sha256')
      .update(`${this.envService.ipHashPepper}:${ipAddress}`)
      .digest('hex');
  }

  buildScopeKey(ipAddress: string, trackingCode: string): string {
    return `tracking:ip:${this.hashIpAddress(ipAddress)}:code:${trackingCode.toUpperCase()}`;
  }

  async assertNotLocked(ipAddress: string, trackingCode: string): Promise<void> {
    const attempt = await this.getAttempt(ipAddress, trackingCode);

    if (!attempt?.lockedUntil || attempt.lockedUntil.getTime() <= Date.now()) {
      return;
    }

    throw new DomainException(
      ErrorCode.AUTH_ACCOUNT_LOCKED,
      'Hesap geçici olarak kilitlendi.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  async recordFailure(
    ipAddress: string,
    trackingCode: string,
    tx?: Prisma.TransactionClient,
  ): Promise<TrackingAttemptLockResult> {
    return this.upsertFailure(ipAddress, trackingCode, tx ?? this.prisma);
  }

  async recordSuccess(
    ipAddress: string,
    trackingCode: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const scopeKey = this.buildScopeKey(ipAddress, trackingCode);
    const ipAddressHash = this.hashIpAddress(ipAddress);
    const now = new Date();

    await client.loginAttempt.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        ipAddressHash,
        trackingCode: trackingCode.toUpperCase(),
        failedCount: 0,
        lockedUntil: null,
        lastAttemptAt: now,
      },
      update: {
        trackingCode: trackingCode.toUpperCase(),
        failedCount: 0,
        lockedUntil: null,
        lastAttemptAt: now,
      },
    });
  }

  private async getAttempt(ipAddress: string, trackingCode: string) {
    const scopeKey = this.buildScopeKey(ipAddress, trackingCode);
    return this.prisma.loginAttempt.findUnique({
      where: { scopeKey },
    });
  }

  private async upsertFailure(
    ipAddress: string,
    trackingCode: string,
    client: AttemptDbClient,
  ): Promise<TrackingAttemptLockResult> {
    const scopeKey = this.buildScopeKey(ipAddress, trackingCode);
    const ipAddressHash = this.hashIpAddress(ipAddress);
    const now = new Date();
    const existing = await client.loginAttempt.findUnique({
      where: { scopeKey },
    });

    const nextFailedCount = (existing?.failedCount ?? 0) + 1;
    const lockoutTriggered = nextFailedCount >= this.envService.bruteForceMaxAttempts;
    const lockedUntil = lockoutTriggered
      ? new Date(now.getTime() + this.envService.bruteForceLockoutMinutes * 60 * 1000)
      : null;

    await client.loginAttempt.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        ipAddressHash,
        trackingCode: trackingCode.toUpperCase(),
        failedCount: nextFailedCount,
        lockedUntil,
        lastAttemptAt: now,
      },
      update: {
        trackingCode: trackingCode.toUpperCase(),
        failedCount: nextFailedCount,
        lockedUntil,
        lastAttemptAt: now,
      },
    });

    return {
      failedCount: nextFailedCount,
      lockedUntil,
      lockoutTriggered,
    };
  }
}
