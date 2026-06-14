import type {
  AdminAuditChainVerifyResponse,
  AdminAuditExportJob,
  AdminSystemHealthResponse,
  ListAdminAuditEventsQuery,
  ListAdminAuditEventsResponse,
  ListAdminDocumentOperationsQuery,
  ListAdminDocumentOperationsResponse,
  RequestAdminAuditExportBody,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

function buildAuditQueryParams(
  query: ListAdminAuditEventsQuery | Omit<RequestAdminAuditExportBody, 'reason'>,
): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (query.eventType) {
    params.eventType = query.eventType;
  }
  if (query.actorUserId) {
    params.actorUserId = query.actorUserId;
  }
  if (query.resourceType) {
    params.resourceType = query.resourceType;
  }
  if (query.resourceId) {
    params.resourceId = query.resourceId;
  }
  if (query.dateFrom) {
    params.dateFrom = query.dateFrom;
  }
  if (query.dateTo) {
    params.dateTo = query.dateTo;
  }
  if ('limit' in query) {
    params.limit = query.limit;
  }
  if ('cursor' in query && query.cursor) {
    params.cursor = query.cursor;
  }

  return params;
}

function buildDocumentOpsQueryParams(
  query: ListAdminDocumentOperationsQuery,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    limit: query.limit,
  };

  if (query.scanStatus) {
    params.scanStatus = query.scanStatus;
  }
  if (query.mimeType) {
    params.mimeType = query.mimeType;
  }
  if (query.dateFrom) {
    params.dateFrom = query.dateFrom;
  }
  if (query.dateTo) {
    params.dateTo = query.dateTo;
  }
  if (query.cursor) {
    params.cursor = query.cursor;
  }

  return params;
}

export async function fetchAdminAuditEvents(
  query: ListAdminAuditEventsQuery,
): Promise<ListAdminAuditEventsResponse> {
  const response = await apiClient.get<ApiSuccessEnvelope<ListAdminAuditEventsResponse>>(
    '/admin/audit-events',
    { params: buildAuditQueryParams(query) },
  );
  return response.data.data;
}

export async function requestAdminAuditExport(
  body: RequestAdminAuditExportBody,
): Promise<AdminAuditExportJob> {
  const response = await apiClient.post<ApiSuccessEnvelope<AdminAuditExportJob>>(
    '/admin/audit-events/export',
    body,
  );
  return response.data.data;
}

export async function fetchAdminAuditExportJob(jobId: string): Promise<AdminAuditExportJob> {
  const response = await apiClient.get<ApiSuccessEnvelope<AdminAuditExportJob>>(
    `/admin/audit-events/export/${jobId}`,
  );
  return response.data.data;
}

export async function verifyAdminAuditChain(): Promise<AdminAuditChainVerifyResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<AdminAuditChainVerifyResponse>>(
    '/admin/audit-events/verify-chain',
  );
  return response.data.data;
}

export async function fetchAdminDocumentOperations(
  query: ListAdminDocumentOperationsQuery,
): Promise<ListAdminDocumentOperationsResponse> {
  const response = await apiClient.get<ApiSuccessEnvelope<ListAdminDocumentOperationsResponse>>(
    '/admin/document-operations',
    { params: buildDocumentOpsQueryParams(query) },
  );
  return response.data.data;
}

export async function fetchAdminSystemHealth(): Promise<AdminSystemHealthResponse> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<AdminSystemHealthResponse>>('/admin/system-health');
  return response.data.data;
}
