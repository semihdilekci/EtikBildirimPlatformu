export const PLATFORM_NAME = 'ethics-platform' as const;

export { Role, ROLE_VALUES } from './enums/role.enum.js';
export type { Role as RoleCode } from './enums/role.enum.js';

export { ClearanceLevel, CLEARANCE_LEVEL_VALUES } from './enums/clearance-level.enum.js';
export type { ClearanceLevel as ClearanceLevelCode } from './enums/clearance-level.enum.js';

export { ErrorCode } from './constants/error-codes.js';
export type { ErrorCodeValue } from './constants/error-codes.js';
