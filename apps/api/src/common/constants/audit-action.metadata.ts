import type { AuditEventTypeCode } from '@ethics/shared';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const AUDIT_ACTION_KEY = 'audit:action';

export interface AuditActionMetadata {
  eventType: AuditEventTypeCode;
  action: string;
  /**
   * Servis katmanı fail-closed audit publish yaptıysa interceptor tekrar yazmaz.
   * Crypto + domain tx örnekleri için kullanılır.
   */
  deferToService?: boolean;
}

export function getAuditAction(
  reflector: Reflector,
  context: ExecutionContext,
): AuditActionMetadata | undefined {
  return reflector.getAllAndOverride<AuditActionMetadata | undefined>(AUDIT_ACTION_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}
