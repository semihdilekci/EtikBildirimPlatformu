export const MasterDataType = {
  COMPANY: 'company',
  LOCATION: 'location',
  FUNCTION: 'function',
  POSITION: 'position',
} as const;

export type MasterDataTypeCode = (typeof MasterDataType)[keyof typeof MasterDataType];

export const MASTER_DATA_TYPE_VALUES = Object.values(
  MasterDataType,
) as readonly MasterDataTypeCode[];

export function isMasterDataType(value: string): value is MasterDataTypeCode {
  return (MASTER_DATA_TYPE_VALUES as readonly string[]).includes(value);
}
