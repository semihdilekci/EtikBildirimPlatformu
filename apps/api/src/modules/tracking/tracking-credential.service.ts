import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type ReportStatusCode } from '@ethics/shared';
import type { Request } from 'express';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TrackingPasswordService } from '../intake/tracking-password.service.js';
import { isValidTrackingCodeFormat } from '../intake/tracking-code.util.js';
import { TRACKING_CODE_HEADER, TRACKING_PASSWORD_HEADER } from './tracking.constants.js';
import type { TrackingReportContext } from './tracking.types.js';

@Injectable()
export class TrackingCredentialService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TrackingPasswordService)
    private readonly trackingPasswordService: TrackingPasswordService,
  ) {}

  extractCredentials(request: Request): { trackingCode: string; password: string } {
    const trackingCode = this.readHeader(request, TRACKING_CODE_HEADER);
    const password = this.readHeader(request, TRACKING_PASSWORD_HEADER);

    if (!trackingCode || !password) {
      throw new DomainException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Takip kodu veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!isValidTrackingCodeFormat(trackingCode)) {
      throw new DomainException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Takip kodu veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      trackingCode: trackingCode.toUpperCase(),
      password,
    };
  }

  async authenticate(
    trackingCode: string,
    password: string,
  ): Promise<TrackingReportContext | null> {
    if (!isValidTrackingCodeFormat(trackingCode)) {
      return null;
    }

    const report = await this.prisma.report.findUnique({
      where: { trackingCode: trackingCode.toUpperCase() },
      select: {
        id: true,
        trackingCode: true,
        trackingCodePasswordHash: true,
        status: true,
        submittedAt: true,
        lastActivityAt: true,
        companyId: true,
      },
    });

    if (!report) {
      return null;
    }

    const passwordValid = await this.trackingPasswordService.verifyPassword(
      password,
      report.trackingCodePasswordHash,
    );

    if (!passwordValid) {
      return null;
    }

    return {
      reportId: report.id,
      trackingCode: report.trackingCode,
      status: report.status as ReportStatusCode,
      submittedAt: report.submittedAt,
      lastActivityAt: report.lastActivityAt,
      companyId: report.companyId,
    };
  }

  private readHeader(request: Request, headerName: string): string | undefined {
    const raw = request.headers[headerName];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }

    if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim().length > 0) {
      return raw[0].trim();
    }

    return undefined;
  }
}
