import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CaseDetail,
  CaseListItem,
  CaseTransitionItem,
  CreateCaseBody,
  CreateCaseResponse,
  CreateTransitionBody,
  CreateTransitionResponse,
  ListCasesQuery,
  UpdateCaseConfidentialityBody,
  UpdateCaseConfidentialityResponse,
} from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  ReportStatus,
  WORKFLOW_VERSION,
  WorkflowCommand,
  getCaseStateLabel,
  getWorkflowCommandLabel,
  type CaseStateCode,
  type WorkflowCommandCode,
} from '@ethics/shared';
import { isClearanceSufficient } from '@ethics/policy';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { FieldMaskingService } from '../../authorization/field-masking.service.js';
import { PolicyScopeService } from '../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CaseAvailableActionsService } from './case-available-actions.service.js';
import {
  buildCaseDetailMaskableData,
  buildCaseListMaskableData,
  collectVisibleFieldNames,
  toCaseDetailApi,
  toCaseListItemApi,
} from './case.mapper.js';
import {
  buildCursorSortCondition,
  decodeCaseListCursor,
  encodeCaseListCursor,
  resolveCaseSortField,
  toSortValue,
} from './case-pagination.util.js';
import { CaseReportDecryptService } from './case-report-decrypt.service.js';
import { TransitionService } from './transition/transition.service.js';

const CASE_DETAIL_SELECT = {
  id: true,
  reportId: true,
  currentState: true,
  workflowVersion: true,
  confidentialityLevel: true,
  companyId: true,
  assignedRapporteurId: true,
  assignedActionOwnerId: true,
  openedAt: true,
  updatedAt: true,
  createdAt: true,
  report: {
    select: {
      id: true,
      categoryGroup: true,
      categories: true,
      incidentDateStart: true,
      urgentRiskFlag: true,
      lastActivityAt: true,
      incidentCountry: true,
      incidentCity: true,
      incidentLocationDetail: true,
      isAnonymous: true,
      incidentDescription: true,
      reporterIdentityName: true,
      reporterIdentityTitle: true,
      reporterIdentityRelation: true,
      reporterContactEmail: true,
      reporterContactPhone: true,
      urgentRiskDescription: true,
      involvedPersons: true,
      witnesses: true,
      categorySpecificData: true,
      encryptionMetadata: true,
    },
  },
  company: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

@Injectable()
export class CaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyScope: PolicyScopeService,
    private readonly fieldMasking: FieldMaskingService,
    private readonly transitionService: TransitionService,
    private readonly auditPublisher: AuditEventPublisher,
    private readonly reportDecryptService: CaseReportDecryptService,
    private readonly availableActionsService: CaseAvailableActionsService,
  ) {}

  async listCases(
    user: AuthenticatedUser,
    query: ListCasesQuery,
  ): Promise<{
    data: CaseListItem[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    const policyScope = this.policyScope.buildCaseScope(user) as Prisma.CaseWhereInput;
    const filterScope = this.buildListFilterScope(user, query);
    const sortField = resolveCaseSortField(query.sortBy);
    const take = query.limit + 1;

    const whereConditions: Prisma.CaseWhereInput[] = [policyScope, filterScope];

    if (query.cursor) {
      try {
        const cursorPayload = decodeCaseListCursor(query.cursor);
        whereConditions.push(buildCursorSortCondition(sortField, query.sortOrder, cursorPayload));
      } catch {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Geçersiz sayfalama imleci.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.prisma.case.findMany({
      where: { AND: whereConditions },
      orderBy: [{ [sortField]: query.sortOrder }, { id: query.sortOrder }],
      take,
      select: {
        id: true,
        reportId: true,
        currentState: true,
        confidentialityLevel: true,
        companyId: true,
        openedAt: true,
        updatedAt: true,
        createdAt: true,
        report: {
          select: {
            id: true,
            categoryGroup: true,
            lastActivityAt: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    const maskedItems = this.fieldMasking.applyCaseFieldPolicyList(
      user,
      pageRows.map((row) =>
        buildCaseListMaskableData(
          {
            ...row,
            workflowVersion: WORKFLOW_VERSION,
            assignedRapporteurId: null,
            assignedActionOwnerId: null,
          },
          {
            id: row.report.id,
            categoryGroup: row.report.categoryGroup,
            categories: [],
            incidentDateStart: null,
            urgentRiskFlag: false,
            lastActivityAt: row.report.lastActivityAt,
          },
          row.company,
        ),
      ),
    );

    const data = maskedItems.map((item) => toCaseListItemApi(item));
    const lastRow = pageRows.at(-1);
    const nextCursor =
      hasMore && lastRow
        ? encodeCaseListCursor({
            id: lastRow.id,
            sortValue:
              sortField === 'currentState' ? lastRow.currentState : toSortValue(lastRow[sortField]),
          })
        : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        total: null,
      },
    };
  }

  async getCaseDetail(
    user: AuthenticatedUser,
    caseId: string,
    correlationId: string,
  ): Promise<CaseDetail> {
    const policyScope = this.policyScope.buildCaseScope(user) as Prisma.CaseWhereInput;
    const caseEntity = await this.prisma.case.findFirst({
      where: {
        AND: [{ id: caseId }, policyScope],
      },
      select: CASE_DETAIL_SELECT,
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const decrypted = await this.reportDecryptService.decryptReportFields({
      id: caseEntity.report.id,
      incidentDescription: caseEntity.report.incidentDescription,
      reporterIdentityName: caseEntity.report.reporterIdentityName,
      reporterIdentityTitle: caseEntity.report.reporterIdentityTitle,
      reporterIdentityRelation: caseEntity.report.reporterIdentityRelation,
      reporterContactEmail: caseEntity.report.reporterContactEmail,
      reporterContactPhone: caseEntity.report.reporterContactPhone,
      urgentRiskDescription: caseEntity.report.urgentRiskDescription,
      involvedPersons: caseEntity.report.involvedPersons,
      witnesses: caseEntity.report.witnesses,
      categorySpecificData: caseEntity.report.categorySpecificData,
      encryptionMetadata: caseEntity.report.encryptionMetadata,
    });

    const maskable = buildCaseDetailMaskableData(
      caseEntity,
      caseEntity.report,
      caseEntity.company,
      decrypted,
    );

    const availableActions = this.availableActionsService.resolve(user, {
      currentState: caseEntity.currentState as CaseStateCode,
      confidentialityLevel: caseEntity.confidentialityLevel as ClearanceLevel,
      assignedRapporteurId: caseEntity.assignedRapporteurId,
      assignedActionOwnerId: caseEntity.assignedActionOwnerId,
    });

    maskable.available_actions = availableActions;

    const masked = this.fieldMasking.applyCaseFieldPolicy(user, maskable);
    const detail = toCaseDetailApi(masked, availableActions);
    detail.assignedRapporteurId = caseEntity.assignedRapporteurId;

    await this.prisma.$transaction(async (tx) => {
      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.CASE_VIEWED,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'case_viewed',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'case',
        resourceId: caseId,
        caseId,
        companyId: caseEntity.companyId,
        correlationId,
        idempotencyKey: `audit:case-viewed:${correlationId}:${caseId}`,
        metadata: {
          fieldsVisible: collectVisibleFieldNames(masked),
          clearanceLevelSnapshot: user.clearanceLevel,
        },
      });
    });

    return detail;
  }

  async listCaseTransitions(
    user: AuthenticatedUser,
    caseId: string,
  ): Promise<CaseTransitionItem[]> {
    await this.assertCaseAccessible(user, caseId);

    const transitions = await this.prisma.caseTransition.findMany({
      where: { caseId },
      orderBy: { transitionedAt: 'asc' },
      select: {
        id: true,
        fromState: true,
        toState: true,
        command: true,
        actorType: true,
        reasonTextMasked: true,
        transitionedAt: true,
        performedByUser: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    return transitions.map((transition) => {
      const fromState = transition.fromState as CaseStateCode;
      const toState = transition.toState as CaseStateCode;
      const command = transition.command as WorkflowCommandCode;

      const item: CaseTransitionItem = {
        id: transition.id,
        fromState,
        toState,
        fromStateLabel: getCaseStateLabel(fromState),
        toStateLabel: getCaseStateLabel(toState),
        command,
        commandLabel: getWorkflowCommandLabel(command),
        actorType: transition.actorType,
        actorDisplayName:
          transition.performedByUser?.displayName ?? transition.performedByUser?.email ?? null,
        transitionedAt: transition.transitionedAt.toISOString(),
      };

      if (
        transition.reasonTextMasked &&
        transition.reasonTextMasked !== '[REDACTED]' &&
        transition.command !== WorkflowCommand.OPEN_CASE
      ) {
        item.reason = transition.reasonTextMasked;
      }

      return item;
    });
  }

  async createCaseFromReport(
    user: AuthenticatedUser,
    body: CreateCaseBody,
    correlationId: string,
  ): Promise<CreateCaseResponse> {
    const auditIdempotencyKey = `audit:case-open:${body.idempotencyKey}`;
    const existingAudit = await this.prisma.auditOutbox.findUnique({
      where: { idempotencyKey: auditIdempotencyKey },
      select: { metadataJson: true },
    });

    if (existingAudit?.metadataJson && typeof existingAudit.metadataJson === 'object') {
      const metadata = existingAudit.metadataJson as Record<string, unknown>;
      if (metadata.reportId === body.reportId && typeof metadata.caseId === 'string') {
        const existingCase = await this.prisma.case.findUnique({
          where: { id: metadata.caseId },
          select: {
            id: true,
            reportId: true,
            currentState: true,
            confidentialityLevel: true,
            companyId: true,
            openedAt: true,
          },
        });

        if (existingCase) {
          return {
            caseId: existingCase.id,
            reportId: existingCase.reportId,
            currentState: existingCase.currentState,
            confidentialityLevel: existingCase.confidentialityLevel,
            companyId: existingCase.companyId,
            openedAt: existingCase.openedAt.toISOString(),
            idempotentReplay: true,
          };
        }
      }
    }

    const report = await this.prisma.report.findUnique({
      where: { id: body.reportId },
      select: {
        id: true,
        status: true,
        caseId: true,
        companyId: true,
        confidentialityLevel: true,
      },
    });

    if (!report) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bildirim bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (report.status !== ReportStatus.SUBMITTED) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Yalnızca gönderilmiş bildirimlerden vaka açılabilir.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (report.caseId) {
      throw new DomainException(
        ErrorCode.CASE_ALREADY_EXISTS,
        'Bu bildirim için zaten bir vaka mevcut.',
        HttpStatus.CONFLICT,
      );
    }

    if (
      !isClearanceSufficient(user.clearanceLevel, report.confidentialityLevel as ClearanceLevel)
    ) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Bu bildirim için yeterli gizlilik yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }

    const openedAt = new Date();

    const createdCase = await this.prisma.$transaction(async (tx) => {
      const caseRecord = await tx.case.create({
        data: {
          reportId: report.id,
          currentState: CaseState.REPORT_SUBMITTED,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: report.confidentialityLevel,
          companyId: report.companyId,
          openedAt,
          createdBy: user.id,
        },
        select: {
          id: true,
          reportId: true,
          currentState: true,
          confidentialityLevel: true,
          companyId: true,
          openedAt: true,
        },
      });

      await tx.caseTransition.create({
        data: {
          caseId: caseRecord.id,
          fromState: CaseState.REPORT_SUBMITTED,
          toState: CaseState.REPORT_SUBMITTED,
          command: WorkflowCommand.OPEN_CASE,
          actorType: AuditActorType.USER,
          performedByUserId: user.id,
          idempotencyKey: body.idempotencyKey,
          transitionedAt: openedAt,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: caseRecord.id },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.CASE_TRANSITION,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: 'case_opened',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'case',
        resourceId: caseRecord.id,
        caseId: caseRecord.id,
        companyId: report.companyId,
        correlationId,
        idempotencyKey: auditIdempotencyKey,
        metadata: {
          reportId: report.id,
          caseId: caseRecord.id,
          command: WorkflowCommand.OPEN_CASE,
        },
      });

      return caseRecord;
    });

    return {
      caseId: createdCase.id,
      reportId: createdCase.reportId,
      currentState: createdCase.currentState,
      confidentialityLevel: createdCase.confidentialityLevel,
      companyId: createdCase.companyId,
      openedAt: createdCase.openedAt.toISOString(),
      idempotentReplay: false,
    };
  }

  async executeTransition(
    user: AuthenticatedUser,
    caseId: string,
    body: CreateTransitionBody,
    correlationId: string,
  ): Promise<CreateTransitionResponse> {
    await this.assertCaseAccessible(user, caseId);

    const result = await this.transitionService.execute({
      caseId,
      command: body.command as WorkflowCommandCode,
      actor: {
        type: AuditActorType.USER,
        userId: user.id,
        roles: user.roles,
        clearanceLevel: user.clearanceLevel,
      },
      idempotencyKey: body.idempotencyKey,
      correlationId,
      reason: body.reason,
      metadata: body.metadata,
    });

    return {
      caseId: result.caseId,
      transitionId: result.transitionId,
      fromState: result.fromState,
      toState: result.toState,
      command: result.command,
      transitionedAt: result.transitionedAt.toISOString(),
      tasksCreated: result.tasksCreated,
      idempotentReplay: result.idempotentReplay,
    };
  }

  async updateConfidentiality(
    user: AuthenticatedUser,
    caseId: string,
    body: UpdateCaseConfidentialityBody,
    correlationId: string,
  ): Promise<UpdateCaseConfidentialityResponse> {
    await this.assertCaseAccessible(user, caseId);

    const auditIdempotencyKey = `audit:case-confidentiality:${body.idempotencyKey}`;
    const existingAudit = await this.prisma.auditOutbox.findUnique({
      where: { idempotencyKey: auditIdempotencyKey },
      select: { metadataJson: true },
    });

    if (existingAudit?.metadataJson && typeof existingAudit.metadataJson === 'object') {
      const metadata = existingAudit.metadataJson as Record<string, unknown>;
      if (metadata.caseId === caseId) {
        const caseEntity = await this.prisma.case.findUnique({
          where: { id: caseId },
          select: {
            confidentialityLevel: true,
            updatedAt: true,
          },
        });

        if (!caseEntity) {
          throw new DomainException(
            ErrorCode.RESOURCE_NOT_FOUND,
            'Vaka bulunamadı.',
            HttpStatus.NOT_FOUND,
          );
        }

        return {
          caseId,
          previousLevel: metadata.previousLevel as ClearanceLevel,
          confidentialityLevel: caseEntity.confidentialityLevel,
          updatedAt: caseEntity.updatedAt.toISOString(),
          idempotentReplay: true,
        };
      }
    }

    const caseEntity = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        reportId: true,
        confidentialityLevel: true,
        companyId: true,
        optimisticLockVersion: true,
      },
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const previousLevel = caseEntity.confidentialityLevel as ClearanceLevel;
    const nextLevel = body.confidentialityLevel as ClearanceLevel;

    if (previousLevel === nextLevel) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Gizlilik seviyesi mevcut değer ile aynı.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!isClearanceSufficient(user.clearanceLevel, nextLevel)) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Hedef gizlilik seviyesi için yetkiniz yetersiz.',
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: {
            id: caseId,
            optimisticLockVersion: caseEntity.optimisticLockVersion,
          },
          data: {
            confidentialityLevel: nextLevel,
            optimisticLockVersion: { increment: 1 },
          },
          select: {
            confidentialityLevel: true,
            updatedAt: true,
          },
        });

        await tx.report.update({
          where: { id: caseEntity.reportId },
          data: { confidentialityLevel: nextLevel },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.CASE_CONFIDENTIALITY_CHANGED,
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: 'case_confidentiality_changed',
          outcome: AuditOutcome.SUCCESS,
          resourceType: 'case',
          resourceId: caseId,
          caseId,
          companyId: caseEntity.companyId,
          correlationId,
          idempotencyKey: auditIdempotencyKey,
          metadata: {
            caseId,
            previousLevel,
            confidentialityLevel: nextLevel,
            reasonMasked: '[REDACTED]',
          },
        });

        return updatedCase;
      });

      return {
        caseId,
        previousLevel,
        confidentialityLevel: updated.confidentialityLevel,
        updatedAt: updated.updatedAt.toISOString(),
        idempotentReplay: false,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new DomainException(
          ErrorCode.CASE_OPTIMISTIC_LOCK,
          'Kayıt başka bir kullanıcı tarafından güncellendi.',
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  private buildListFilterScope(
    user: AuthenticatedUser,
    query: ListCasesQuery,
  ): Prisma.CaseWhereInput {
    const filters: Prisma.CaseWhereInput[] = [];

    if (query.status?.length) {
      filters.push({ currentState: { in: query.status } });
    }

    if (query.companyId) {
      filters.push({ companyId: query.companyId });
    }

    if (query.confidentialityLevel) {
      filters.push({ confidentialityLevel: query.confidentialityLevel });
    }

    if (query.dateFrom || query.dateTo) {
      filters.push({
        openedAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
        },
      });
    }

    if (query.assignedToMe) {
      filters.push({
        OR: [{ assignedRapporteurId: user.id }, { assignedActionOwnerId: user.id }],
      });
    }

    if (filters.length === 0) {
      return {};
    }

    if (filters.length === 1) {
      return filters[0] ?? {};
    }

    return { AND: filters };
  }

  private async assertCaseAccessible(user: AuthenticatedUser, caseId: string): Promise<void> {
    const scope = this.policyScope.buildCaseScope(user) as Prisma.CaseWhereInput;
    const caseEntity = await this.prisma.case.findFirst({
      where: {
        AND: [{ id: caseId }, scope],
      },
      select: { id: true },
    });

    if (!caseEntity) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Vaka bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
