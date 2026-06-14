import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ListAdminAuditEventsQuery,
  ListAdminDocumentOperationsQuery,
  RequestAdminAuditExportBody,
} from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  fetchAdminAuditEvents,
  fetchAdminAuditExportJob,
  fetchAdminDocumentOperations,
  fetchAdminSystemHealth,
  requestAdminAuditExport,
  verifyAdminAuditChain,
} from '@/features/admin/api/admin-monitoring.api';

const THIRTY_SECONDS_MS = 30 * 1000;
const FIFTEEN_SECONDS_MS = 15 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useAdminAuditEventsQuery(filters: ListAdminAuditEventsQuery) {
  return useQuery({
    queryKey: queryKeys.admin.auditEvents(filters),
    queryFn: () => fetchAdminAuditEvents(filters),
    staleTime: THIRTY_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    placeholderData: (previous) => previous,
  });
}

export function useAdminAuditExportJobQuery(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.auditExportJob(jobId ?? ''),
    queryFn: () => {
      if (!jobId) {
        throw new Error('Export job ID gerekli.');
      }
      return fetchAdminAuditExportJob(jobId);
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'PROCESSING') {
        return 2000;
      }
      return false;
    },
  });
}

export function useRequestAdminAuditExportMutation() {
  return useMutation({
    mutationFn: (body: RequestAdminAuditExportBody) => requestAdminAuditExport(body),
  });
}

export function useVerifyAdminAuditChainMutation() {
  return useMutation({
    mutationFn: () => verifyAdminAuditChain(),
  });
}

export function useAdminDocumentOperationsQuery(filters: ListAdminDocumentOperationsQuery) {
  return useQuery({
    queryKey: queryKeys.admin.documentOperations(filters),
    queryFn: () => fetchAdminDocumentOperations(filters),
    staleTime: THIRTY_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    placeholderData: (previous) => previous,
  });
}

export function useAdminSystemHealthQuery() {
  return useQuery({
    queryKey: queryKeys.admin.systemHealth(),
    queryFn: () => fetchAdminSystemHealth(),
    staleTime: FIFTEEN_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    refetchInterval: THIRTY_SECONDS_MS,
  });
}
