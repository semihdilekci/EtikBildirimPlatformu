import type { AdminMasterDataItem, AdminMasterDataSyncRun } from '@ethics/dto';
import type { Company, Function, HrSyncRun, Location, Position } from '@prisma/client';
import { MasterDataType, type MasterDataTypeCode } from '@ethics/shared';

type MasterDataRecord = Company | Location | Function | Position;

const HR_SAP_INTEGRATION_NAME = 'HR_SAP_USER_SYNC';

function hasCompanyId(record: MasterDataRecord): record is Location | Function | Position {
  return 'companyId' in record;
}

function mapSyncRunStatus(status: string): AdminMasterDataSyncRun['status'] {
  if (status === 'STARTED') {
    return 'RUNNING';
  }
  if (status === 'FAILED') {
    return 'FAILED';
  }
  return 'COMPLETED';
}

export function toAdminMasterDataSyncRun(run: HrSyncRun): AdminMasterDataSyncRun {
  return {
    id: run.id,
    integrationName: HR_SAP_INTEGRATION_NAME,
    status: mapSyncRunStatus(run.status),
    recordCount: run.recordsProcessed ?? 0,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorCount: run.status === 'FAILED' ? 1 : 0,
    errorDetailMasked: run.errorDetailMasked ?? null,
  };
}

export function toAdminMasterDataItem(
  type: MasterDataTypeCode,
  record: MasterDataRecord,
  companyName: string | null = null,
): AdminMasterDataItem {
  const companyId = hasCompanyId(record) ? record.companyId : null;

  return {
    id: record.id,
    type,
    name: record.name,
    code: record.code,
    companyId,
    companyName: type === MasterDataType.COMPANY ? record.name : companyName,
    sourceSystem: record.sourceSystem,
    sourceRecordId: record.sourceRecordId,
    sourceUpdatedAt: record.sourceUpdatedAt?.toISOString() ?? null,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
