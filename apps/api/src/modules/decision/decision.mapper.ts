import type { DecisionVoteListItem, CastVoteBody } from '@ethics/dto';

export function toDecisionVoteListItem(vote: {
  id: string;
  voteType: string;
  isSilentAcceptance: boolean;
  votedAt: Date;
  voter: { displayName: string };
}): DecisionVoteListItem {
  return {
    id: vote.id,
    voterDisplayName: vote.voter.displayName,
    voteType: vote.voteType as DecisionVoteListItem['voteType'],
    isSilentAcceptance: vote.isSilentAcceptance,
    votedAt: vote.votedAt.toISOString(),
  };
}

export function toCastVoteResponse(vote: { id: string; voteType: string; votedAt: Date }): {
  id: string;
  voteType: CastVoteBody['voteType'] | 'SILENT_ACCEPTANCE';
  votedAt: string;
} {
  return {
    id: vote.id,
    voteType: vote.voteType as CastVoteBody['voteType'] | 'SILENT_ACCEPTANCE',
    votedAt: vote.votedAt.toISOString(),
  };
}
