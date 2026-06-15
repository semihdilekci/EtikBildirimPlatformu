import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InternalReportDetail,
  ListPendingReportsQuery,
  PendingReportListItem,
} from '@ethics/dto';
import { PermissionCode, rolesHavePermission } from '@ethics/policy';
import { ErrorCode, ReportStatus } from '@ethics/shared';

import { FieldMaskingService } from '../../authorization/field-masking.service.js';
import { buildDenyAllWhere } from '../../authorization/policy-scope.constants.js';
import { PolicyScopeService } from '../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CaseReportDecryptService } from '../case-management/case-report-decrypt.service.js';
import {
  buildInternalReportDetailMaskableData,
  toInternalReportDetailApi,
  toPendingReportListItem,
} from './internal-report.mapper.js';
import {
  buildPendingReportCursorSortCondition,
  decodePendingReportListCursor,
  encodePendingReportListCursor,
  resolvePendingReportSortField,
  toPendingReportSortValue,
} from './internal-report-pagination.util.js';

const PENDING_REPORT_LIST_SELECT = {
  id: true,
  trackingCode: true,
  status: true,
  confidentialityLevel: true,
  companyId: true,
  categoryGroup: true,
  categories: true,
  urgentRiskFlag: true,
  submittedAt: true,
  incidentCountry: true,
  incidentCity: true,
  company: {
    select: {
      name: true,
    },
  },
} as const;

const PENDING_REPORT_DETAIL_SELECT = {
  ...PENDING_REPORT_LIST_SELECT,
  isAnonymous: true,
  incidentLocationDetail: true,
  incidentDateStart: true,
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
  _count: {
    select: {
      attachments: true,
    },
  },
} as const;

@Injectable()
export class InternalReportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyScopeService) private readonly policyScope: PolicyScopeService,
    @Inject(FieldMaskingService) private readonly fieldMasking: FieldMaskingService,
    @Inject(CaseReportDecryptService)
    private readonly reportDecryptService: CaseReportDecryptService,
  ) {}

  async listPendingReports(
    user: AuthenticatedUser,
    query: ListPendingReportsQuery,
  ): Promise<{
    data: PendingReportListItem[];
    pagination: { nextCursor: string | null; hasMore: boolean; total: null };
  }> {
    const scope = this.buildPendingReportScope(user);
    const sortField = resolvePendingReportSortField(query.sortBy);
    const sortOrder = query.sortOrder;
    const limit = query.limit;

    const filters: Prisma.ReportWhereInput[] = [scope];

    if (query.companyId) {
      filters.push({ companyId: query.companyId });
    }

    if (query.urgentRiskOnly) {
      filters.push({ urgentRiskFlag: true });
    }

    if (query.cursor) {
      try {
        const cursorPayload = decodePendingReportListCursor(query.cursor);
        filters.push(buildPendingReportCursorSortCondition(sortField, sortOrder, cursorPayload));
      } catch {
        throw new DomainException(
          ErrorCode.VALIDATION_FAILED,
          'Geçersiz sayfalama imleci.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const where: Prisma.ReportWhereInput =
      filters.length === 1 ? (filters[0] ?? scope) : { AND: filters };

    const rows = await this.prisma.report.findMany({
      where,
      orderBy: [
        sortField === 'urgentRiskFlag' ? { urgentRiskFlag: sortOrder } : { submittedAt: sortOrder },
        { id: sortOrder },
      ],
      take: limit + 1,
      select: PENDING_REPORT_LIST_SELECT,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const data = pageRows.map((row) => toPendingReportListItem(row));
    const lastRow = pageRows.at(-1);
    const nextCursor =
      hasMore && lastRow
        ? encodePendingReportListCursor({
            id: lastRow.id,
            sortValue: toPendingReportSortValue(sortField, lastRow),
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

  async getInternalReportDetail(
    user: AuthenticatedUser,
    reportId: string,
  ): Promise<InternalReportDetail> {
    const scope = this.buildPendingReportScope(user);
    const report = await this.prisma.report.findFirst({
      where: {
        AND: [{ id: reportId }, scope],
      },
      select: PENDING_REPORT_DETAIL_SELECT,
    });

    if (!report) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bildirim bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const decrypted = await this.reportDecryptService.decryptReportFields({
      id: report.id,
      incidentDescription: report.incidentDescription,
      reporterIdentityName: report.reporterIdentityName,
      reporterIdentityTitle: report.reporterIdentityTitle,
      reporterIdentityRelation: report.reporterIdentityRelation,
      reporterContactEmail: report.reporterContactEmail,
      reporterContactPhone: report.reporterContactPhone,
      urgentRiskDescription: report.urgentRiskDescription,
      involvedPersons: report.involvedPersons,
      witnesses: report.witnesses,
      categorySpecificData: report.categorySpecificData,
      encryptionMetadata: report.encryptionMetadata,
    });

    const maskable = buildInternalReportDetailMaskableData(report, decrypted);
    const masked = this.fieldMasking.applyCaseFieldPolicy(user, maskable);

    return toInternalReportDetailApi(masked);
  }

  private buildPendingReportScope(user: AuthenticatedUser): Prisma.ReportWhereInput {
    if (!rolesHavePermission(user.roles, PermissionCode.CASE_PRE_REVIEW)) {
      return buildDenyAllWhere();
    }

    const allowedLevels = this.policyScope.getAllowedLevels(user.clearanceLevel);

    return {
      status: ReportStatus.SUBMITTED,
      caseId: null,
      confidentialityLevel: {
        in: [...allowedLevels],
      },
    };
  }
}
