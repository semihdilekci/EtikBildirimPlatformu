import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTransitionBody, ListCasesQuery } from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  createCaseTransition,
  fetchCaseDetail,
  fetchCases,
  fetchCaseTransitions,
} from '@/features/cases/api/cases.api';

const THIRTY_SECONDS_MS = 30 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useCasesListQuery(filters: ListCasesQuery) {
  return useQuery({
    queryKey: queryKeys.cases.list(filters),
    queryFn: () => fetchCases(filters),
    staleTime: THIRTY_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    placeholderData: (previous) => previous,
  });
}

export function useCaseDetailQuery(caseId: string) {
  return useQuery({
    queryKey: queryKeys.cases.detail(caseId),
    queryFn: () => fetchCaseDetail(caseId),
    enabled: Boolean(caseId),
    staleTime: 0,
  });
}

export function useCaseTransitionsQuery(caseId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cases.transitions(caseId),
    queryFn: () => fetchCaseTransitions(caseId),
    enabled: Boolean(caseId) && enabled,
    staleTime: THIRTY_SECONDS_MS,
  });
}

export function useCreateCaseTransitionMutation(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransitionBody) => createCaseTransition(caseId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.transitions(caseId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.all() }),
      ]);
    },
  });
}
