import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveSlaPolicyBatchBody,
  CreateBusinessCalendarEntryBody,
  DeleteBusinessCalendarEntryBody,
  ListBusinessCalendarQuery,
  UpdateSlaPolicyBody,
} from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  approveSlaPolicyBatch,
  createBusinessCalendarEntry,
  deleteBusinessCalendarEntry,
  fetchBusinessCalendar,
  fetchSlaPolicies,
  updateSlaPolicy,
} from '@/features/admin/api/admin-sla.api';

const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useSlaPoliciesQuery() {
  return useQuery({
    queryKey: queryKeys.admin.slaPolicies(),
    queryFn: fetchSlaPolicies,
    staleTime: ONE_MINUTE_MS,
  });
}

export function useUpdateSlaPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskType, body }: { taskType: string; body: UpdateSlaPolicyBody }) =>
      updateSlaPolicy(taskType, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.slaPolicies() });
    },
  });
}

export function useApproveSlaPolicyBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: string; body: ApproveSlaPolicyBatchBody }) =>
      approveSlaPolicyBatch(batchId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.slaPolicies() });
    },
  });
}

export function useBusinessCalendarQuery(query: ListBusinessCalendarQuery = {}) {
  return useQuery({
    queryKey: queryKeys.admin.businessCalendar(query),
    queryFn: () => fetchBusinessCalendar(query),
    staleTime: FIVE_MINUTES_MS,
  });
}

export function useCreateBusinessCalendarEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBusinessCalendarEntryBody) => createBusinessCalendarEntry(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'businessCalendar'] });
    },
  });
}

export function useDeleteBusinessCalendarEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, body }: { entryId: string; body: DeleteBusinessCalendarEntryBody }) =>
      deleteBusinessCalendarEntry(entryId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'businessCalendar'] });
    },
  });
}
