import type { AuditEventTypeCode } from '@ethics/shared';
import { SetMetadata } from '@nestjs/common';

import { AUDIT_ACTION_KEY, type AuditActionMetadata } from '../constants/audit-action.metadata.js';

export interface AuditActionOptions {
  deferToService?: boolean;
}

/**
 * Mutating endpoint audit iskeleti — AuditInterceptor handler sonrası outbox yazar.
 * Domain tx içinde publish gerekiyorsa `deferToService: true` ile servis katmanına bırakılır.
 */
export const AuditAction = (
  eventType: AuditEventTypeCode,
  action: string,
  options?: AuditActionOptions,
): ReturnType<typeof SetMetadata> => {
  const metadata: AuditActionMetadata = {
    eventType,
    action,
    deferToService: options?.deferToService,
  };

  return SetMetadata(AUDIT_ACTION_KEY, metadata);
};
