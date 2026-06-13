import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ClearanceLevel, Role, VoteType } from '@ethics/shared';
import type { CastVoteBody } from '@ethics/dto';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DecisionController } from '../decision.controller.js';
import { DecisionService } from '../decision.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

const memberUser: AuthenticatedUser = {
  id: 'decision-ctrl-member-1',
  email: 'member@ethics.local',
  displayName: 'Member',
  roles: [Role.COUNCIL_MEMBER],
  clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

describe('DecisionController', () => {
  let app: INestApplication;
  const listVotes = vi.fn();
  const castVote = vi.fn();

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  async function createApp(user: AuthenticatedUser = memberUser): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DecisionController],
      providers: [
        {
          provide: DecisionService,
          useValue: {
            listVotes,
            castVote,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter(createSafeLoggerMock() as never));
    app.use(
      (
        req: Request & { correlationId?: string; user?: AuthenticatedUser },
        _res: Response,
        next: NextFunction,
      ) => {
        req.correlationId = 'corr-decision-ctrl-1';
        req.user = user;
        next();
      },
    );
    await app.init();
  }

  it('GET /cases/:caseId/votes servisi çağırır', async () => {
    listVotes.mockResolvedValue([
      {
        id: 'vote-1',
        voterDisplayName: 'Üye A',
        voteType: VoteType.APPROVE,
        isSilentAcceptance: false,
        votedAt: '2026-06-13T12:00:00.000Z',
      },
    ]);

    await createApp();

    const response = await request(app.getHttpServer()).get('/cases/case-1/votes');

    expect(response.status).toBe(HttpStatus.OK);
    expect(listVotes).toHaveBeenCalledWith(memberUser, 'case-1');
    expect(response.body.data).toHaveLength(1);
  });

  it('POST /cases/:caseId/votes servisi çağırır', async () => {
    castVote.mockResolvedValue({
      id: 'vote-1',
      voteType: VoteType.APPROVE,
      votedAt: '2026-06-13T12:00:00.000Z',
    });

    await createApp();

    const body: CastVoteBody = {
      voteType: VoteType.APPROVE,
      idempotencyKey: randomUUID(),
    };

    const response = await request(app.getHttpServer()).post('/cases/case-1/votes').send(body);

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(castVote).toHaveBeenCalledWith(memberUser, 'case-1', body, 'corr-decision-ctrl-1');
    expect(response.body.data.voteType).toBe(VoteType.APPROVE);
  });
});
