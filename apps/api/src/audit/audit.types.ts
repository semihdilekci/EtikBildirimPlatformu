import type { Prisma } from '@prisma/client';

import type {
  AuditActorTypeCode,
  AuditEventCategoryCode,
  AuditEventTypeCode,
  AuditOutcomeCode,
  AuditSeverityCode,
} from '@ethics/shared';

export type AuditTransactionClient = Prisma.TransactionClient;

export interface PublishAuditEventInput {
  eventType: AuditEventTypeCode;
  actorType: AuditActorTypeCode;
  actorId?: string;
  action: string;
  outcome: AuditOutcomeCode;
  resourceType?: string;
  resourceId?: string;
  caseId?: string;
  companyId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
  severity?: AuditSeverityCode;
  eventCategory?: AuditEventCategoryCode;
}

export interface PublishedAuditOutboxRecord {
  id: string;
  eventType: AuditEventTypeCode;
  dispatchStatus: string;
}

export interface AuditChainRow {
  id: string;
  prevHash: string | null;
  eventHash: string | null;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  eventCount: number;
  brokenAtEventId?: string;
}

export interface AuditChainQueryPort {
  fetchOrderedChainRows(): Promise<AuditChainRow[]>;
}
