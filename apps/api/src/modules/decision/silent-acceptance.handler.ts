import { Inject, Injectable } from '@nestjs/common';
import { CaseState, MEMBER_APPROVAL_SILENT_ACCEPTANCE_MS } from '@ethics/shared';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service.js';
import { DecisionService } from './decision.service.js';

export interface SilentAcceptanceClock {
  now(): Date;
}

export interface SilentAcceptanceProcessResult {
  casesScanned: number;
  silentVotesCreated: number;
  casesAdvanced: number;
}

@Injectable()
export class SilentAcceptanceHandler {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DecisionService) private readonly decisionService: DecisionService,
    private readonly clock: SilentAcceptanceClock = { now: () => new Date() },
  ) {}

  async processPendingBatch(): Promise<SilentAcceptanceProcessResult> {
    const now = this.clock.now();
    const cases = await this.prisma.case.findMany({
      where: { currentState: CaseState.MEMBER_APPROVAL },
      select: {
        id: true,
        companyId: true,
      },
    });

    let silentVotesCreated = 0;
    let casesAdvanced = 0;

    for (const caseEntity of cases) {
      const result = await this.processCase(caseEntity.id, caseEntity.companyId, now);
      silentVotesCreated += result.silentVotesCreated;
      if (result.advanced) {
        casesAdvanced += 1;
      }
    }

    return {
      casesScanned: cases.length,
      silentVotesCreated,
      casesAdvanced,
    };
  }

  private async processCase(
    caseId: string,
    companyId: string,
    now: Date,
  ): Promise<{ silentVotesCreated: number; advanced: boolean }> {
    const activeTransition = await this.decisionService.findActiveMemberApprovalTransition(
      caseId,
      this.prisma,
    );

    if (!activeTransition) {
      return { silentVotesCreated: 0, advanced: false };
    }

    const deadline = new Date(
      activeTransition.transitionedAt.getTime() + MEMBER_APPROVAL_SILENT_ACCEPTANCE_MS,
    );

    if (now.getTime() < deadline.getTime()) {
      return { silentVotesCreated: 0, advanced: false };
    }

    const memberIds = await this.decisionService.listEligibleCouncilMemberIds(this.prisma);
    const existingVotes = await this.prisma.decisionVote.findMany({
      where: { transitionId: activeTransition.id },
      select: { voterUserId: true },
    });
    const votedMemberIds = new Set(existingVotes.map((vote) => vote.voterUserId));
    const pendingMemberIds = memberIds.filter((memberId) => !votedMemberIds.has(memberId));

    if (pendingMemberIds.length === 0) {
      const advanced = await this.prisma.$transaction(async (tx) =>
        this.decisionService.advanceToDecisionDraftIfUnanimous(
          tx,
          caseId,
          activeTransition.id,
          randomUUID(),
        ),
      );
      return { silentVotesCreated: 0, advanced };
    }

    let silentVotesCreated = 0;
    let advanced = false;
    const correlationId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      for (const memberId of pendingMemberIds) {
        const result = await this.decisionService.createSilentAcceptanceVote(tx, {
          caseId,
          transitionId: activeTransition.id,
          voterUserId: memberId,
          companyId,
          correlationId,
        });

        if (result.created) {
          silentVotesCreated += 1;
        }
      }

      advanced = await this.decisionService.advanceToDecisionDraftIfUnanimous(
        tx,
        caseId,
        activeTransition.id,
        correlationId,
      );
    });

    return { silentVotesCreated, advanced };
  }
}
