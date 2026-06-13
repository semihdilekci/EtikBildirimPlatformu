import type {
  CaseDetail,
  CaseTransitionItem,
  CreateTransitionBody,
  CreateTransitionResponse,
  ListCasesQuery,
  ListCasesResponse,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

function buildListQueryParams(query: ListCasesQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };

  if (query.status?.length) {
    params.status = query.status.join(',');
  }

  if (query.companyId) {
    params.companyId = query.companyId;
  }

  if (query.confidentialityLevel) {
    params.confidentialityLevel = query.confidentialityLevel;
  }

  if (query.dateFrom) {
    params.dateFrom = query.dateFrom;
  }

  if (query.dateTo) {
    params.dateTo = query.dateTo;
  }

  if (query.assignedToMe === true) {
    params.assignedToMe = true;
  }

  if (query.cursor) {
    params.cursor = query.cursor;
  }

  return params;
}

export async function fetchCases(query: ListCasesQuery): Promise<ListCasesResponse> {
  const response = await apiClient.get<ListCasesResponse>('/cases', {
    params: buildListQueryParams(query),
  });
  return response.data;
}

export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const response = await apiClient.get<ApiSuccessEnvelope<CaseDetail>>(
    `/cases/${encodeURIComponent(caseId)}`,
  );
  return response.data.data;
}

export async function fetchCaseTransitions(caseId: string): Promise<CaseTransitionItem[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<CaseTransitionItem[]>>(
    `/cases/${encodeURIComponent(caseId)}/transitions`,
  );
  return response.data.data;
}

export async function createCaseTransition(
  caseId: string,
  body: CreateTransitionBody,
): Promise<CreateTransitionResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<CreateTransitionResponse>>(
    `/cases/${encodeURIComponent(caseId)}/transitions`,
    body,
  );
  return response.data.data;
}
