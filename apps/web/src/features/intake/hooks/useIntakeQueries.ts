import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import {
  fetchIntakeCategories,
  fetchIntakeCompanies,
  fetchIntakeKvkkText,
} from '@/features/intake/api/intake.api';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

export function useIntakeCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.intake.categories(),
    queryFn: fetchIntakeCategories,
    staleTime: THIRTY_MINUTES_MS,
    gcTime: ONE_HOUR_MS,
  });
}

export function useIntakeCompaniesQuery() {
  return useQuery({
    queryKey: queryKeys.intake.companies(),
    queryFn: fetchIntakeCompanies,
    staleTime: TEN_MINUTES_MS,
    gcTime: THIRTY_MINUTES_MS,
  });
}

export function useIntakeKvkkTextQuery() {
  return useQuery({
    queryKey: queryKeys.intake.kvkkText(),
    queryFn: fetchIntakeKvkkText,
    staleTime: THIRTY_MINUTES_MS,
    gcTime: ONE_HOUR_MS,
  });
}
