import type {
  CompleteTaskBody,
  DelegateTaskBody,
  ListTasksQuery,
  ListTasksResponse,
  TaskDetail,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

function buildListQueryParams(query: ListTasksQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };

  if (query.status?.length) {
    params.status = query.status.join(',');
  }

  if (query.taskType) {
    params.taskType = query.taskType;
  }

  if (query.caseId) {
    params.caseId = query.caseId;
  }

  if (query.dueBefore) {
    params.dueBefore = query.dueBefore;
  }

  if (query.dueAfter) {
    params.dueAfter = query.dueAfter;
  }

  if (query.cursor) {
    params.cursor = query.cursor;
  }

  return params;
}

export async function fetchTasks(query: ListTasksQuery): Promise<ListTasksResponse> {
  const response = await apiClient.get<ListTasksResponse>('/tasks', {
    params: buildListQueryParams(query),
  });
  return response.data;
}

export async function fetchTaskDetail(taskId: string): Promise<TaskDetail> {
  const response = await apiClient.get<ApiSuccessEnvelope<TaskDetail>>(
    `/tasks/${encodeURIComponent(taskId)}`,
  );
  return response.data.data;
}

export async function completeTask(taskId: string, body: CompleteTaskBody): Promise<TaskDetail> {
  const response = await apiClient.post<ApiSuccessEnvelope<TaskDetail>>(
    `/tasks/${encodeURIComponent(taskId)}/complete`,
    body,
  );
  return response.data.data;
}

export async function delegateTask(taskId: string, body: DelegateTaskBody): Promise<TaskDetail> {
  const response = await apiClient.post<ApiSuccessEnvelope<TaskDetail>>(
    `/tasks/${encodeURIComponent(taskId)}/delegate`,
    body,
  );
  return response.data.data;
}
