import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ClearanceLevel, Role, TaskStatus, TaskType } from '@ethics/shared';
import type { CompleteTaskBody, DelegateTaskBody, ListTasksQuery } from '@ethics/dto';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { TaskController } from '../task.controller.js';
import { TaskService } from '../task.service.js';

function createSafeLoggerMock() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
  };
}

const secretaryUser: AuthenticatedUser = {
  id: 'task-ctrl-secretary-1',
  email: 'secretary@ethics.local',
  displayName: 'Secretary',
  roles: [Role.COUNCIL_SECRETARY],
  clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

describe('TaskController', () => {
  let app: INestApplication;
  const listTasks = vi.fn();
  const getTaskDetail = vi.fn();
  const completeTask = vi.fn();
  const delegateTask = vi.fn();

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  async function createApp(user: AuthenticatedUser = secretaryUser): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskService,
          useValue: {
            listTasks,
            getTaskDetail,
            completeTask,
            delegateTask,
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
        req.correlationId = 'corr-task-ctrl-1';
        req.user = user;
        next();
      },
    );
    await app.init();
  }

  it('GET /tasks servisi çağırır', async () => {
    listTasks.mockResolvedValue({
      data: [
        {
          id: 'task-1',
          caseId: 'case-1',
          taskType: TaskType.SECRETARIAT_REVIEW_TASK,
          taskTypeLabel: 'Ön Değerlendirme',
          status: TaskStatus.PENDING,
          assignedRole: Role.COUNCIL_SECRETARY,
          dueAt: '2026-06-20T12:00:00.000Z',
          slaStatus: 'ON_TRACK',
          createdAt: '2026-06-13T12:00:00.000Z',
        },
      ],
      pagination: { nextCursor: null, hasMore: false, total: null },
    });

    await createApp();

    const response = await request(app.getHttpServer()).get('/tasks?status=PENDING&limit=10');

    expect(response.status).toBe(HttpStatus.OK);
    expect(listTasks).toHaveBeenCalledWith(
      secretaryUser,
      expect.objectContaining({ status: ['PENDING'], limit: 10 } satisfies Partial<ListTasksQuery>),
    );
    expect(response.body.data).toHaveLength(1);
  });

  it('GET /tasks/:id detay zarfı döner', async () => {
    getTaskDetail.mockResolvedValue({
      id: 'task-1',
      caseId: 'case-1',
      taskType: TaskType.SECRETARIAT_REVIEW_TASK,
      taskTypeLabel: 'Ön Değerlendirme',
      status: TaskStatus.PENDING,
      assignedRole: Role.COUNCIL_SECRETARY,
      assignedUserId: null,
      delegatedFromTaskId: null,
      dueAt: null,
      slaStatus: null,
      outcome: null,
      completedAt: null,
      createdAt: '2026-06-13T12:00:00.000Z',
      updatedAt: '2026-06-13T12:00:00.000Z',
      case: {
        id: 'case-1',
        currentState: 'report_submitted',
        currentStateLabel: 'Bildirim Alındı',
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        companyId: 'company-1',
        companyName: 'Seed Company',
      },
    });

    await createApp();

    const response = await request(app.getHttpServer()).get('/tasks/task-1');

    expect(response.status).toBe(HttpStatus.OK);
    expect(getTaskDetail).toHaveBeenCalledWith(secretaryUser, 'task-1');
    expect(response.body.data.id).toBe('task-1');
  });

  it('POST /tasks/:id/complete servisi çağırır', async () => {
    completeTask.mockResolvedValue({ id: 'task-1', status: TaskStatus.COMPLETED });

    await createApp();

    const body: CompleteTaskBody = {
      outcome: 'Tamamlandı.',
      idempotencyKey: randomUUID(),
    };

    const response = await request(app.getHttpServer()).post('/tasks/task-1/complete').send(body);

    expect(response.status).toBe(HttpStatus.OK);
    expect(completeTask).toHaveBeenCalledWith(secretaryUser, 'task-1', body, 'corr-task-ctrl-1');
  });

  it('POST /tasks/:id/delegate servisi çağırır', async () => {
    delegateTask.mockResolvedValue({ id: 'task-2', status: TaskStatus.PENDING });

    await createApp();

    const body: DelegateTaskBody = {
      delegateToUserId: 'user-2',
      reason: 'Devir gerekçesi.',
    };

    const response = await request(app.getHttpServer()).post('/tasks/task-1/delegate').send(body);

    expect(response.status).toBe(HttpStatus.OK);
    expect(delegateTask).toHaveBeenCalledWith(secretaryUser, 'task-1', body, 'corr-task-ctrl-1');
  });
});
