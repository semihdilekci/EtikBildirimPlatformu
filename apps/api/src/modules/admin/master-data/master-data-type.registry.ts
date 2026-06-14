import type { Company, Function, Location, Position } from '@prisma/client';
import { MasterDataType, type MasterDataTypeCode } from '@ethics/shared';

export type MasterDataEntity = Company | Location | Function | Position;

export interface MasterDataTypeConfig {
  type: MasterDataTypeCode;
  resourceType: string;
  requiresCompanyId: boolean;
}

export const MASTER_DATA_TYPE_CONFIG: Record<MasterDataTypeCode, MasterDataTypeConfig> = {
  [MasterDataType.COMPANY]: {
    type: MasterDataType.COMPANY,
    resourceType: 'company',
    requiresCompanyId: false,
  },
  [MasterDataType.LOCATION]: {
    type: MasterDataType.LOCATION,
    resourceType: 'location',
    requiresCompanyId: true,
  },
  [MasterDataType.FUNCTION]: {
    type: MasterDataType.FUNCTION,
    resourceType: 'function',
    requiresCompanyId: true,
  },
  [MasterDataType.POSITION]: {
    type: MasterDataType.POSITION,
    resourceType: 'position',
    requiresCompanyId: true,
  },
};

export function getMasterDataTypeConfig(type: MasterDataTypeCode): MasterDataTypeConfig {
  return MASTER_DATA_TYPE_CONFIG[type];
}
