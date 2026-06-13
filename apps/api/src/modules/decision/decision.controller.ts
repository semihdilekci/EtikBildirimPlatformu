import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditEventType } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import { castVoteBodySchema, type CastVoteBody } from '@ethics/dto';
import type { Request } from 'express';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePolicy } from '../../common/decorators/require-policy.decorator.js';
import { createZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DecisionService } from './decision.service.js';

type CorrelatedRequest = Request & { correlationId?: string };

const VOTE_READ_RATE_LIMIT = { limit: 60, ttl: 60_000 } as const;
const VOTE_MUTATION_RATE_LIMIT = { limit: 30, ttl: 60_000 } as const;

@Controller('cases/:caseId/votes')
export class DecisionController {
  constructor(@Inject(DecisionService) private readonly decisionService: DecisionService) {}

  @RequirePolicy(PermissionCode.CASE_READ)
  @Throttle({ default: VOTE_READ_RATE_LIMIT })
  @Get()
  async listVotes(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.decisionService.listVotes(user, caseId);
    return { data };
  }

  @RequirePolicy(PermissionCode.COUNCIL_VOTE_DECISION)
  @AuditAction(AuditEventType.DECISION_VOTE_CAST, 'decision_vote_cast', { deferToService: true })
  @Throttle({ default: VOTE_MUTATION_RATE_LIMIT })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async castVote(
    @Param('caseId') caseId: string,
    @Body(createZodValidationPipe(castVoteBodySchema)) body: CastVoteBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: CorrelatedRequest,
  ) {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const data = await this.decisionService.castVote(user, caseId, body, correlationId);
    return { data };
  }
}
