export const VoteType = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SILENT_ACCEPTANCE: 'SILENT_ACCEPTANCE',
} as const;

export type VoteTypeCode = (typeof VoteType)[keyof typeof VoteType];

export const VOTE_TYPE_VALUES = Object.values(VoteType);
