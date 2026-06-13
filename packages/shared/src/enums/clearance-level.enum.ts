/** User and resource confidentiality clearance levels */
export const ClearanceLevel = {
  NORMAL: 'NORMAL',
  SENSITIVE: 'SENSITIVE',
  STRICTLY_CONFIDENTIAL: 'STRICTLY_CONFIDENTIAL',
} as const;

export type ClearanceLevel = (typeof ClearanceLevel)[keyof typeof ClearanceLevel];

export const CLEARANCE_LEVEL_VALUES = Object.values(ClearanceLevel) as readonly ClearanceLevel[];
