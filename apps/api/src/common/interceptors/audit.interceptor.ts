import { randomUUID } from 'node:crypto';

import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditActorType, AuditOutcome, type AuditEventTypeCode } from '@ethics/shared';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { RedactionService } from '../../audit/redaction.service.js';
import { getAuditAction } from '../constants/audit-action.metadata.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type AuditedRequest = Request & {
  correlationId?: string;
  user?: Partial<AuthenticatedUser> & { userId?: string };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(RedactionService) private readonly redactionService: RedactionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = getAuditAction(this.reflector, context);

    if (!metadata || metadata.deferToService) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditedRequest>();

    return next.handle().pipe(
      tap((responseBody) => {
        void this.publishAfterSuccess(metadata, request, responseBody);
      }),
    );
  }

  private async publishAfterSuccess(
    metadata: { eventType: AuditEventTypeCode; action: string },
    request: AuditedRequest,
    responseBody: unknown,
  ): Promise<void> {
    const correlationId = request.correlationId ?? randomUUID();
    const actorId = this.resolveActorId(request);
    const safeMetadata = this.buildSafeMetadata(responseBody);

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.auditPublisher.publish(tx, {
          eventType: metadata.eventType,
          actorType: actorId ? AuditActorType.USER : AuditActorType.SYSTEM,
          actorId,
          action: metadata.action,
          outcome: AuditOutcome.SUCCESS,
          correlationId,
          metadata: safeMetadata,
          idempotencyKey: `http:${metadata.action}:${correlationId}`,
        });
      });
    } catch {
      // Interceptor iskeleti — handler başarılı döndü; audit publish hatası request'i geri almaz.
      // Fail-closed domain+audit pattern servis katmanında uygulanır.
    }
  }

  private resolveActorId(request: AuditedRequest): string | undefined {
    const user = request.user;

    if (user && typeof user.id === 'string') {
      return user.id;
    }

    if (user && typeof user.userId === 'string') {
      return user.userId;
    }

    return undefined;
  }

  private buildSafeMetadata(responseBody: unknown): Record<string, unknown> | undefined {
    if (responseBody === null || responseBody === undefined) {
      return undefined;
    }

    const redacted = this.redactionService.redactAuditSnapshot(responseBody);

    if (typeof redacted !== 'object' || redacted === null || Array.isArray(redacted)) {
      return { value: redacted };
    }

    return redacted as Record<string, unknown>;
  }
}
