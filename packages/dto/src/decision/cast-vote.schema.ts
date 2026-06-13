import { VoteType } from '@ethics/shared';
import { z } from 'zod';

export const castVoteBodySchema = z
  .object({
    voteType: z.enum([VoteType.APPROVE, VoteType.REJECT]),
    reason: z.string().min(1).max(5000).nullable().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((value, ctx) => {
    if (value.voteType === VoteType.REJECT) {
      if (!value.reason || value.reason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'İtiraz gerekçesi zorunludur.',
          path: ['reason'],
        });
      }
    }
  });

export type CastVoteBody = z.infer<typeof castVoteBodySchema>;

export const castVoteResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    voteType: z.enum([VoteType.APPROVE, VoteType.REJECT, VoteType.SILENT_ACCEPTANCE]),
    votedAt: z.string().datetime(),
  }),
});

export type CastVoteResponse = z.infer<typeof castVoteResponseSchema>;

export const decisionVoteListItemSchema = z.object({
  id: z.string(),
  voterDisplayName: z.string(),
  voteType: z.enum([VoteType.APPROVE, VoteType.REJECT, VoteType.SILENT_ACCEPTANCE]),
  isSilentAcceptance: z.boolean(),
  votedAt: z.string().datetime(),
});

export type DecisionVoteListItem = z.infer<typeof decisionVoteListItemSchema>;

export const listDecisionVotesResponseSchema = z.object({
  data: z.array(decisionVoteListItemSchema),
});

export type ListDecisionVotesResponse = z.infer<typeof listDecisionVotesResponseSchema>;
