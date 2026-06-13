import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  AuditEventType,
  CaseState,
  ClearanceLevel,
  ReportCategoryGroup,
  Role,
  WorkflowCommand,
} from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import type { CreateTransitionBody, UpdateCaseConfidentialityBody } from '@ethics/dto';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../../common/filters/global-exception.filter.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { CaseController } from '../case.controller.js';
import { CaseService } from '../case.service.js';

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
  id: 'ctrl-secretary-1',
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

describe('CaseController', () => {
  let app: INestApplication;
  const executeTransition = vi.fn();
  const updateConfidentiality = vi.fn();
  const listCases = vi.fn();
  const getCaseDetail = vi.fn();
  const listCaseTransitions = vi.fn();
  const createCaseFromReport = vi.fn();

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  async function createApp(user: AuthenticatedUser = secretaryUser): Promise<void> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CaseController],
      providers: [
        {
          provide: CaseService,
          useValue: {
            executeTransition,
            updateConfidentiality,
            listCases,
            getCaseDetail,
            listCaseTransitions,
            createCaseFromReport,
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
        req.correlationId = 'corr-case-ctrl-1';
        req.user = user;
        next();
      },
    );
    await app.init();
  }

  it('GET /cases servisi cagirir ve liste zarfı doner', async () => {
    listCases.mockResolvedValue({
      data: [
        {
          id: 'case-list-1',
          reportId: 'report-list-1',
          currentState: CaseState.REPORT_SUBMITTED,
          currentStateLabel: 'Bildirim Alındı',
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          companyId: 'company-1',
          companyName: 'Seed Company',
          categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
          openedAt: '2026-06-13T12:00:00.000Z',
          lastActivityAt: '2026-06-13T12:00:00.000Z',
        },
      ],
      pagination: { nextCursor: null, hasMore: false, total: null },
    });

    await createApp();

    const response = await request(app.getHttpServer()).get('/cases?limit=10');

    expect(response.status).toBe(HttpStatus.OK);
    expect(listCases).toHaveBeenCalledWith(secretaryUser, expect.objectContaining({ limit: 10 }));
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.hasMore).toBe(false);
  });

  it('GET /cases/:id servisi cagirir ve data zarfı doner', async () => {
    const caseId = 'case-detail-1';
    getCaseDetail.mockResolvedValue({
      id: caseId,
      reportId: 'report-detail-1',
      currentState: CaseState.CHAIR_GATE,
      currentStateLabel: 'Kurul Başkanı Kapısı',
      workflowVersion: '1.0',
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      companyId: 'company-1',
      companyName: 'Seed Company',
      categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
      categories: [],
      urgentRiskFlag: false,
      openedAt: '2026-06-13T12:00:00.000Z',
      availableActions: [WorkflowCommand.APPROVE_AGENDA],
    });

    await createApp();

    const response = await request(app.getHttpServer()).get(`/cases/${caseId}`);

    expect(response.status).toBe(HttpStatus.OK);
    expect(getCaseDetail).toHaveBeenCalledWith(secretaryUser, caseId, 'corr-case-ctrl-1');
    expect(response.body.data.availableActions).toContain(WorkflowCommand.APPROVE_AGENDA);
  });

  it('GET /cases/:id/transitions servisi cagirir ve data zarfı doner', async () => {
    const caseId = 'case-transitions-1';
    listCaseTransitions.mockResolvedValue([
      {
        id: 'transition-1',
        fromState: CaseState.REPORT_SUBMITTED,
        toState: CaseState.SECRETARIAT_REVIEW,
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        actorType: 'USER',
        actorDisplayName: 'Secretary',
        reasonTextMasked: null,
        transitionedAt: '2026-06-13T12:00:00.000Z',
      },
    ]);

    await createApp();

    const response = await request(app.getHttpServer()).get(`/cases/${caseId}/transitions`);

    expect(response.status).toBe(HttpStatus.OK);
    expect(listCaseTransitions).toHaveBeenCalledWith(secretaryUser, caseId);
    expect(response.body.data).toHaveLength(1);
  });

  it('POST /cases servisi cagirir ve 201 doner', async () => {
    const body = {
      reportId: 'report-open-1',
      idempotencyKey: randomUUID(),
    };

    createCaseFromReport.mockResolvedValue({
      caseId: 'case-open-1',
      reportId: body.reportId,
      currentState: CaseState.REPORT_SUBMITTED,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      companyId: 'company-1',
      openedAt: '2026-06-13T12:00:00.000Z',
      idempotentReplay: false,
    });

    await createApp();

    const response = await request(app.getHttpServer()).post('/cases').send(body);

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(createCaseFromReport).toHaveBeenCalledWith(secretaryUser, body, 'corr-case-ctrl-1');
    expect(response.body.data.caseId).toBe('case-open-1');
  });

  it('listCases RequirePolicy CASE_LIST ile isaretli', () => {
    const permission = Reflect.getMetadata(
      'auth:requirePolicy',
      CaseController.prototype.listCases,
    );
    expect(permission).toBe(PermissionCode.CASE_LIST);
  });

  it('getCaseDetail RequirePolicy CASE_READ ile isaretli', () => {
    const permission = Reflect.getMetadata(
      'auth:requirePolicy',
      CaseController.prototype.getCaseDetail,
    );
    expect(permission).toBe(PermissionCode.CASE_READ);
  });

  it('createCaseFromReport RequirePolicy CASE_PRE_REVIEW ile isaretli', () => {
    const permission = Reflect.getMetadata(
      'auth:requirePolicy',
      CaseController.prototype.createCaseFromReport,
    );
    expect(permission).toBe(PermissionCode.CASE_PRE_REVIEW);
  });

  it('POST /cases/:id/transitions servisi cagirir ve data zarfı doner', async () => {
    const caseId = 'case-ctrl-001';
    const body: CreateTransitionBody = {
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      idempotencyKey: randomUUID(),
      metadata: {},
    };

    executeTransition.mockResolvedValue({
      caseId,
      transitionId: 'transition-ctrl-1',
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      transitionedAt: '2026-06-13T12:00:00.000Z',
      tasksCreated: [],
      idempotentReplay: false,
    });

    await createApp();

    const response = await request(app.getHttpServer())
      .post(`/cases/${caseId}/transitions`)
      .send(body);

    expect(response.status).toBe(HttpStatus.OK);
    expect(executeTransition).toHaveBeenCalledWith(secretaryUser, caseId, body, 'corr-case-ctrl-1');
    expect(response.body.data).toMatchObject({
      caseId,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
    });
  });

  it('gecersiz body → VALIDATION_FAILED', async () => {
    await createApp();

    const response = await request(app.getHttpServer())
      .post('/cases/case-ctrl-001/transitions')
      .send({
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: 'not-a-uuid',
      });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(executeTransition).not.toHaveBeenCalled();
  });

  it('createTransition RequirePolicy CASE_TRANSITION ile isaretli', () => {
    const permission = Reflect.getMetadata(
      'auth:requirePolicy',
      CaseController.prototype.createTransition,
    );
    expect(permission).toBe(PermissionCode.CASE_TRANSITION);
  });

  it('createTransition AuditAction CASE_TRANSITION ile isaretli', () => {
    const auditMetadata = Reflect.getMetadata(
      'audit:action',
      CaseController.prototype.createTransition,
    );
    expect(auditMetadata).toMatchObject({
      eventType: AuditEventType.CASE_TRANSITION,
      action: 'case_transition',
      deferToService: true,
    });
  });

  it('PATCH /cases/:id/confidentiality servisi cagirir ve data zarfı doner', async () => {
    const caseId = 'case-ctrl-conf-001';
    const body: UpdateCaseConfidentialityBody = {
      confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      reason: 'Kurul karari.',
      idempotencyKey: randomUUID(),
    };

    updateConfidentiality.mockResolvedValue({
      caseId,
      previousLevel: ClearanceLevel.SENSITIVE,
      confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      updatedAt: '2026-06-13T12:00:00.000Z',
      idempotentReplay: false,
    });

    await createApp();

    const response = await request(app.getHttpServer())
      .patch(`/cases/${caseId}/confidentiality`)
      .send(body);

    expect(response.status).toBe(HttpStatus.OK);
    expect(updateConfidentiality).toHaveBeenCalledWith(
      secretaryUser,
      caseId,
      body,
      'corr-case-ctrl-1',
    );
    expect(response.body.data).toMatchObject({
      caseId,
      confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });
  });

  it('updateConfidentiality RequirePolicy CASE_UPDATE_CONFIDENTIALITY ile isaretli', () => {
    const permission = Reflect.getMetadata(
      'auth:requirePolicy',
      CaseController.prototype.updateConfidentiality,
    );
    expect(permission).toBe(PermissionCode.CASE_UPDATE_CONFIDENTIALITY);
  });

  it('updateConfidentiality AuditAction CASE_CONFIDENTIALITY_CHANGED ile isaretli', () => {
    const auditMetadata = Reflect.getMetadata(
      'audit:action',
      CaseController.prototype.updateConfidentiality,
    );
    expect(auditMetadata).toMatchObject({
      eventType: AuditEventType.CASE_CONFIDENTIALITY_CHANGED,
      action: 'case_confidentiality_changed',
      deferToService: true,
    });
  });
});
