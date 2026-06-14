import type {
  AdminMasterDataItem,
  AdminMasterDataSyncRun,
  ListAdminMasterDataResponse,
  ListAdminMasterDataSyncRunsResponse,
} from '@ethics/dto';
import { MasterDataType } from '@ethics/shared';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchAdminMasterDataSyncRuns(): Promise<AdminMasterDataSyncRun[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<ListAdminMasterDataSyncRunsResponse>>(
    '/admin/master-data/sync-runs',
  );
  return response.data.data.data;
}

export async function fetchAdminMasterDataList(
  type:
    | typeof MasterDataType.COMPANY
    | typeof MasterDataType.LOCATION
    | typeof MasterDataType.FUNCTION,
): Promise<AdminMasterDataItem[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<ListAdminMasterDataResponse>>(
    `/admin/master-data/${type}`,
    { params: { limit: 50 } },
  );
  return response.data.data.data;
}
