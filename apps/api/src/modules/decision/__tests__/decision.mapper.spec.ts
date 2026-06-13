import { VoteType } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { toCastVoteResponse, toDecisionVoteListItem } from '../decision.mapper.js';

describe('decision.mapper', () => {
  it('toDecisionVoteListItem maps vote fields', () => {
    const item = toDecisionVoteListItem({
      id: 'vote-1',
      voteType: VoteType.APPROVE,
      isSilentAcceptance: false,
      votedAt: new Date('2026-06-13T12:00:00.000Z'),
      voter: { displayName: 'Üye A' },
    });

    expect(item).toEqual({
      id: 'vote-1',
      voterDisplayName: 'Üye A',
      voteType: VoteType.APPROVE,
      isSilentAcceptance: false,
      votedAt: '2026-06-13T12:00:00.000Z',
    });
  });

  it('toCastVoteResponse maps cast vote payload', () => {
    const response = toCastVoteResponse({
      id: 'vote-2',
      voteType: VoteType.SILENT_ACCEPTANCE,
      votedAt: new Date('2026-06-14T08:00:00.000Z'),
    });

    expect(response).toEqual({
      id: 'vote-2',
      voteType: VoteType.SILENT_ACCEPTANCE,
      votedAt: '2026-06-14T08:00:00.000Z',
    });
  });
});
