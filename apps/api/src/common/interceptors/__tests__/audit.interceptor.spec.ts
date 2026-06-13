import 'reflect-metadata';

import { Controller, Get, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditActorType, AuditEventType, AuditOutcome } from '@ethics/shared';
import type { Request } from 'express';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { RedactionService } from '../../../audit/redaction.service.js';
import { AuditAction } from '../../decorators/audit-action.decorator.js';
import { AuditInterceptor } from '../audit.interceptor.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Controller('audit-test')
class AuditTestController {
  @Get('plain')
  plainRoute() {
    return { data: { ok: true } };
  }

  @AuditAction(AuditEventType.SSO_LOGOUT_SUCCESS, 'logout_audit')
  @Post('audited')
  auditedRoute() {
    return { data: { action: 'done', userEmail: 'alice@example.com' } };
  }

  @AuditAction(AuditEventType.SYSTEM_SETTING_CHANGED, 'deferred_audit', { deferToService: true })
  @Post('deferred')
  deferredRoute() {
    return { data: { auditHandled: true } };
  }

  @AuditAction(AuditEventType.AUTHZ_DENIED, 'failing_audit')
  @Post('failing')
  failingRoute() {
    throw new Error('handler failed');
  }
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditPublisher: AuditEventPublisher;
  let prisma: PrismaService;
  let redactionService: RedactionService;

  const mockRequest = {
    correlationId: 'corr-test-1',
    user: { id: 'user-1' },
  } as Request & { correlationId: string; user: { id: string } };

  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => AuditTestController.prototype.auditedRoute,
    getClass: () => AuditTestController,
  };

  beforeEach(() => {
    auditPublisher = {
      publish: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
    } as unknown as AuditEventPublisher;

    prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
    } as unknown as PrismaService;

    redactionService = {
      redactAuditSnapshot: vi.fn((value: unknown) => value),
    } as unknown as RedactionService;

    interceptor = new AuditInterceptor(new Reflector(), prisma, auditPublisher, redactionService);
  });

  it("@AuditAction olmayan endpoint'te sessiz geçer — publish çağrılmaz", async () => {
    const plainContext = {
      ...mockContext,
      getHandler: () => AuditTestController.prototype.plainRoute,
    };

    const next = { handle: () => of({ data: { ok: true } }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(plainContext as never, next).subscribe({
        complete: () => resolve(),
      });
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditPublisher.publish).not.toHaveBeenCalled();
  });

  it('@AuditAction sonrası başarılı handler audit outbox publish eder', async () => {
    const auditedContext = {
      ...mockContext,
      getHandler: () => AuditTestController.prototype.auditedRoute,
      getClass: () => AuditTestController,
    };

    const next = { handle: () => of({ data: { action: 'done' } }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(auditedContext as never, next).subscribe({
        complete: () => resolve(),
      });
    });

    await vi.waitFor(() => {
      expect(auditPublisher.publish).toHaveBeenCalled();
    });

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: AuditEventType.SSO_LOGOUT_SUCCESS,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: 'logout_audit',
        outcome: AuditOutcome.SUCCESS,
        correlationId: 'corr-test-1',
      }),
    );
    expect(redactionService.redactAuditSnapshot).toHaveBeenCalled();
  });

  it('deferToService: true iken interceptor publish yapmaz', async () => {
    const deferredContext = {
      ...mockContext,
      getHandler: () => AuditTestController.prototype.deferredRoute,
      getClass: () => AuditTestController,
    };

    const next = { handle: () => of({ data: { auditHandled: true } }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(deferredContext as never, next).subscribe({
        complete: () => resolve(),
      });
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditPublisher.publish).not.toHaveBeenCalled();
  });

  it('handler hata fırlatırsa audit publish yapılmaz', async () => {
    const failingContext = {
      ...mockContext,
      getHandler: () => AuditTestController.prototype.failingRoute,
      getClass: () => AuditTestController,
    };

    const next = { handle: () => throwError(() => new Error('handler failed')) };

    await expect(
      new Promise<void>((resolve, reject) => {
        interceptor.intercept(failingContext as never, next).subscribe({
          next: () => resolve(),
          error: (error: unknown) => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      }),
    ).rejects.toThrow('handler failed');

    expect(auditPublisher.publish).not.toHaveBeenCalled();
  });

  it('session userId ile actor çözümler', async () => {
    const userIdRequest = {
      correlationId: 'corr-user-id',
      user: { userId: 'session-user-1' },
    } as Request & { correlationId: string; user: { userId: string } };

    const context = {
      switchToHttp: () => ({ getRequest: () => userIdRequest }),
      getHandler: () => AuditTestController.prototype.auditedRoute,
      getClass: () => AuditTestController,
    };

    const next = { handle: () => of({ data: { ok: true } }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context as never, next).subscribe({ complete: () => resolve() });
    });

    await vi.waitFor(() => expect(auditPublisher.publish).toHaveBeenCalled());

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: 'session-user-1' }),
    );
  });

  it('actor yoksa SYSTEM actorType kullanır', async () => {
    const anonymousRequest = { correlationId: 'corr-anon' } as Request & { correlationId: string };
    const context = {
      switchToHttp: () => ({ getRequest: () => anonymousRequest }),
      getHandler: () => AuditTestController.prototype.auditedRoute,
      getClass: () => AuditTestController,
    };

    const next = { handle: () => of(undefined) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context as never, next).subscribe({ complete: () => resolve() });
    });

    await vi.waitFor(() => expect(auditPublisher.publish).toHaveBeenCalled());

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorType: AuditActorType.SYSTEM,
        actorId: undefined,
        metadata: undefined,
      }),
    );
  });

  it('redacted metadata primitive ise value anahtarıyla sarar', async () => {
    vi.mocked(redactionService.redactAuditSnapshot).mockReturnValue('masked-string');

    const auditedContext = {
      ...mockContext,
      getHandler: () => AuditTestController.prototype.auditedRoute,
      getClass: () => AuditTestController,
    };

    const next = { handle: () => of('raw-response') };

    await new Promise<void>((resolve) => {
      interceptor.intercept(auditedContext as never, next).subscribe({ complete: () => resolve() });
    });

    await vi.waitFor(() => expect(auditPublisher.publish).toHaveBeenCalled());

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: { value: 'masked-string' } }),
    );
  });
});
