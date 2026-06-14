import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveActionMatrixBatchBody,
  ApproveFieldVisibilityBatchBody,
  ApproveSystemSettingBatchBody,
  UpdateActionMatrixBody,
  UpdateFieldVisibilityBody,
  UpdateSystemSettingBody,
} from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  approveActionMatrixBatch,
  approveFieldVisibilityBatch,
  approveSystemSettingBatch,
  fetchActionMatrix,
  fetchFieldVisibilityMatrix,
  fetchSystemSettings,
  updateActionMatrixRow,
  updateFieldVisibility,
  updateSystemSetting,
} from '@/features/admin/api/admin-config.api';

const ONE_MINUTE_MS = 60 * 1000;

export function useSystemSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.systemSettings(),
    queryFn: fetchSystemSettings,
    staleTime: ONE_MINUTE_MS,
  });
}

export function useUpdateSystemSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: UpdateSystemSettingBody }) =>
      updateSystemSetting(key, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemSettings() });
    },
  });
}

export function useApproveSystemSettingBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: string; body: ApproveSystemSettingBatchBody }) =>
      approveSystemSettingBatch(batchId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemSettings() });
    },
  });
}

export function useFieldVisibilityMatrixQuery() {
  return useQuery({
    queryKey: queryKeys.admin.fieldVisibility(),
    queryFn: fetchFieldVisibilityMatrix,
    staleTime: ONE_MINUTE_MS,
  });
}

export function useUpdateFieldVisibilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFieldVisibilityBody) => updateFieldVisibility(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.fieldVisibility() });
    },
  });
}

export function useApproveFieldVisibilityBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: string; body: ApproveFieldVisibilityBatchBody }) =>
      approveFieldVisibilityBatch(batchId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.fieldVisibility() });
    },
  });
}

export function useActionMatrixQuery() {
  return useQuery({
    queryKey: queryKeys.admin.actionMatrix(),
    queryFn: fetchActionMatrix,
    staleTime: ONE_MINUTE_MS,
  });
}

export function useUpdateActionMatrixMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, body }: { actionId: string; body: UpdateActionMatrixBody }) =>
      updateActionMatrixRow(actionId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.actionMatrix() });
    },
  });
}

export function useApproveActionMatrixBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: string; body: ApproveActionMatrixBatchBody }) =>
      approveActionMatrixBatch(batchId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.actionMatrix() });
    },
  });
}
