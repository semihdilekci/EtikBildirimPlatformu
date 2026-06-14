import type {
  AdminAuditEventItem,
  ListAdminAuditEventsQuery,
  RequestAdminAuditExportBody,
} from '@ethics/dto';
import type { Prisma } from '@prisma/client';

function readMetadataString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export function mapAuditEventRow(row: {
  id: string;
  occurredAt: Date;
  recordedAt: Date;
  eventType: string;
  eventCategory: string;
  severity: string;
  actorType: string;
  actorId: string | null;
  action: string;
  outcome: string;
  correlationId: string | null;
  metadataJson: Prisma.JsonValue | null;
}): AdminAuditEventItem {
  const metadata = row.metadataJson;

  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    eventType: row.eventType,
    eventCategory: row.eventCategory,
    severity: row.severity,
    actorType: row.actorType,
    actorId: row.actorId,
    action: row.action,
    outcome: row.outcome,
    correlationId: row.correlationId,
    resourceType: readMetadataString(metadata, 'resourceType'),
    resourceId: readMetadataString(metadata, 'resourceId'),
    metadata:
      metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata
        : null,
  };
}

export function buildAuditEventWhere(
  query: ListAdminAuditEventsQuery | Omit<RequestAdminAuditExportBody, 'reason'>,
): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = {};
  const metadataFilters: Prisma.AuditEventWhereInput[] = [];

  if (query.eventType) {
    where.eventType = query.eventType;
  }

  if (query.actorUserId) {
    where.actorId = query.actorUserId;
  }

  if (query.resourceType) {
    metadataFilters.push({
      metadataJson: {
        path: ['resourceType'],
        equals: query.resourceType,
      },
    });
  }

  if (query.resourceId) {
    metadataFilters.push({
      metadataJson: {
        path: ['resourceId'],
        equals: query.resourceId,
      },
    });
  }

  if (metadataFilters.length > 0) {
    where.AND = metadataFilters;
  }

  if (query.dateFrom || query.dateTo) {
    where.occurredAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  return where;
}

export function auditExportFilterFromBody(
  body: RequestAdminAuditExportBody,
): Omit<RequestAdminAuditExportBody, 'reason'> {
  return {
    eventType: body.eventType,
    actorUserId: body.actorUserId,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
  };
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    text = String(value);
  } else {
    text = JSON.stringify(value);
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildAuditCsvRow(values: readonly unknown[]): string {
  return values.map((value) => escapeCsvValue(value)).join(',');
}

export const AUDIT_CSV_HEADERS = [
  'id',
  'occurred_at',
  'event_type',
  'event_category',
  'severity',
  'actor_type',
  'actor_id',
  'action',
  'outcome',
  'correlation_id',
  'resource_type',
  'resource_id',
] as const;
