import { MasterDataType } from '@ethics/shared';
import { useQuery } from '@tanstack/react-query';

import {
  fetchAdminMasterDataList,
  fetchAdminMasterDataSyncRuns,
} from '@/features/admin/api/admin-master-data.api';
import { queryKeys } from '@/api/query-keys';

const MASTER_DATA_STALE_TIME_MS = 60_000;

export function useAdminMasterDataSyncRunsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.masterDataSyncRuns(),
    queryFn: fetchAdminMasterDataSyncRuns,
    staleTime: MASTER_DATA_STALE_TIME_MS,
  });
}

export function useAdminMasterDataCompaniesQuery() {
  return useQuery({
    queryKey: queryKeys.admin.masterDataList(MasterDataType.COMPANY),
    queryFn: () => fetchAdminMasterDataList(MasterDataType.COMPANY),
    staleTime: MASTER_DATA_STALE_TIME_MS,
  });
}

export function useAdminMasterDataLocationsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.masterDataList(MasterDataType.LOCATION),
    queryFn: () => fetchAdminMasterDataList(MasterDataType.LOCATION),
    staleTime: MASTER_DATA_STALE_TIME_MS,
  });
}

export function useAdminMasterDataFunctionsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.masterDataList(MasterDataType.FUNCTION),
    queryFn: () => fetchAdminMasterDataList(MasterDataType.FUNCTION),
    staleTime: MASTER_DATA_STALE_TIME_MS,
  });
}
