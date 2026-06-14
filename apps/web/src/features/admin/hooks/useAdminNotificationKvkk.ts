import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveKvkkTextBatchBody,
  ApproveNotificationTemplateBatchBody,
  CreateKvkkTextBody,
  PreviewNotificationTemplateBody,
  SendTestNotificationTemplateBody,
  UpdateNotificationTemplateBody,
} from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  approveKvkkTextBatch,
  approveNotificationTemplateBatch,
  createKvkkText,
  fetchKvkkTexts,
  fetchNotificationTemplates,
  previewNotificationTemplate,
  sendTestNotificationTemplate,
  updateNotificationTemplate,
} from '@/features/admin/api/admin-notification-kvkk.api';

const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useNotificationTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.admin.notificationTemplates(),
    queryFn: fetchNotificationTemplates,
    staleTime: ONE_MINUTE_MS,
  });
}

export function useUpdateNotificationTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateCode,
      body,
    }: {
      templateCode: string;
      body: UpdateNotificationTemplateBody;
    }) => updateNotificationTemplate(templateCode, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.notificationTemplates() });
    },
  });
}

export function useApproveNotificationTemplateBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      batchId,
      body,
    }: {
      batchId: string;
      body: ApproveNotificationTemplateBatchBody;
    }) => approveNotificationTemplateBatch(batchId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.notificationTemplates() });
    },
  });
}

export function usePreviewNotificationTemplateMutation() {
  return useMutation({
    mutationFn: ({
      templateCode,
      body,
    }: {
      templateCode: string;
      body: PreviewNotificationTemplateBody;
    }) => previewNotificationTemplate(templateCode, body),
  });
}

export function useSendTestNotificationTemplateMutation() {
  return useMutation({
    mutationFn: ({
      templateCode,
      body,
    }: {
      templateCode: string;
      body: SendTestNotificationTemplateBody;
    }) => sendTestNotificationTemplate(templateCode, body),
  });
}

export function useKvkkTextsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.kvkkTexts(),
    queryFn: fetchKvkkTexts,
    staleTime: FIVE_MINUTES_MS,
  });
}

export function useCreateKvkkTextMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateKvkkTextBody) => createKvkkText(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.kvkkTexts() });
    },
  });
}

export function useApproveKvkkTextBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: string; body: ApproveKvkkTextBatchBody }) =>
      approveKvkkTextBatch(batchId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.kvkkTexts() });
    },
  });
}
