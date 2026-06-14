import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createCompanyMasterDataBodySchema,
  createScopedMasterDataBodySchema,
  updateCompanyMasterDataBodySchema,
  updateScopedMasterDataBodySchema,
  type AdminMasterDataItem,
  type CreateCompanyMasterDataBody,
  type CreateScopedMasterDataBody,
  type ListAdminMasterDataQuery,
  type ListAdminMasterDataResponse,
  type ListAdminMasterDataSyncRunsResponse,
  type UpdateCompanyMasterDataBody,
  type UpdateScopedMasterDataBody,
} from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ErrorCode,
  isMasterDataType,
  MasterDataType,
  type MasterDataTypeCode,
} from '@ethics/shared';
import type { ZodType } from 'zod';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { toAdminMasterDataItem, toAdminMasterDataSyncRun } from './admin-master-data.mapper.js';
import { getMasterDataTypeConfig } from './master-data-type.registry.js';

type CreateBody = CreateCompanyMasterDataBody | CreateScopedMasterDataBody;
type UpdateBody = UpdateCompanyMasterDataBody | UpdateScopedMasterDataBody;

const SYNC_RUN_HISTORY_LIMIT = 30;

@Injectable()
export class AdminMasterDataService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
  ) {}

  assertMasterDataType(type: string): MasterDataTypeCode {
    if (!isMasterDataType(type)) {
      throw new DomainException(
        ErrorCode.ADMIN_MASTER_DATA_TYPE_INVALID,
        'Geçersiz master data tipi.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return type;
  }

  async listSyncRuns(): Promise<ListAdminMasterDataSyncRunsResponse> {
    const runs = await this.prisma.hrSyncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: SYNC_RUN_HISTORY_LIMIT,
    });

    return {
      data: runs.map(toAdminMasterDataSyncRun),
    };
  }

  async list(
    rawType: string,
    query: ListAdminMasterDataQuery,
  ): Promise<ListAdminMasterDataResponse> {
    const type = this.assertMasterDataType(rawType);
    const config = getMasterDataTypeConfig(type);

    const where = this.buildListWhere(type, query);
    const take = query.limit + 1;

    const records = await this.findMany(type, {
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: config.requiresCompanyId ? { company: { select: { name: true } } } : undefined,
    });

    const hasMore = records.length > query.limit;
    const page = hasMore ? records.slice(0, query.limit) : records;

    return {
      data: page.map((record) => this.mapRecord(type, record)),
      pagination: {
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
        hasMore,
      },
    };
  }

  async getById(rawType: string, id: string): Promise<AdminMasterDataItem> {
    const type = this.assertMasterDataType(rawType);
    const record = await this.findUniqueOrThrow(type, id);
    return this.mapRecord(type, record);
  }

  async create(
    actor: AuthenticatedUser,
    rawType: string,
    body: unknown,
    correlationId: string,
  ): Promise<AdminMasterDataItem> {
    const type = this.assertMasterDataType(rawType);
    const parsed = this.parseCreateBody(type, body);
    const config = getMasterDataTypeConfig(type);

    if (config.requiresCompanyId) {
      await this.assertActiveCompany((parsed as CreateScopedMasterDataBody).companyId);
    }

    await this.assertCodeAvailable(type, parsed.code, {
      companyId: config.requiresCompanyId
        ? (parsed as CreateScopedMasterDataBody).companyId
        : undefined,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const record = await this.createRecord(tx, type, parsed);

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.MASTER_DATA_CREATED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'master_data_created',
        outcome: AuditOutcome.ALLOWED,
        resourceType: config.resourceType,
        resourceId: record.id,
        companyId: config.requiresCompanyId
          ? (parsed as CreateScopedMasterDataBody).companyId
          : record.id,
        correlationId,
        idempotencyKey: `master-data-create:${type}:${record.id}`,
        metadata: {
          master_data_type: type,
          code: record.code,
          name: record.name,
          is_active: record.isActive,
        },
      });

      return record;
    });

    return this.mapRecord(type, created);
  }

  async update(
    actor: AuthenticatedUser,
    rawType: string,
    id: string,
    body: unknown,
    correlationId: string,
  ): Promise<AdminMasterDataItem> {
    const type = this.assertMasterDataType(rawType);
    const parsed = this.parseUpdateBody(type, body);
    const config = getMasterDataTypeConfig(type);
    const existing = await this.findUniqueOrThrow(type, id);

    if (
      config.requiresCompanyId &&
      this.isScopedUpdateBody(parsed) &&
      parsed.companyId !== undefined
    ) {
      await this.assertActiveCompany(parsed.companyId);
    }

    if (parsed.code !== undefined) {
      const companyId =
        this.isScopedUpdateBody(parsed) && parsed.companyId !== undefined
          ? parsed.companyId
          : config.requiresCompanyId && 'companyId' in existing
            ? (existing.companyId as string)
            : undefined;

      await this.assertCodeAvailable(type, parsed.code, {
        companyId,
        excludeId: id,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await this.updateRecord(tx, type, id, parsed, existing);

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.MASTER_DATA_UPDATED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'master_data_updated',
        outcome: AuditOutcome.ALLOWED,
        resourceType: config.resourceType,
        resourceId: record.id,
        companyId:
          config.requiresCompanyId && 'companyId' in record
            ? (record.companyId as string)
            : record.id,
        correlationId,
        idempotencyKey: `master-data-update:${type}:${record.id}:${record.updatedAt.toISOString()}`,
        metadata: {
          master_data_type: type,
          changed_fields: Object.keys(parsed),
        },
      });

      return record;
    });

    return this.mapRecord(type, updated);
  }

  async softDelete(
    actor: AuthenticatedUser,
    rawType: string,
    id: string,
    correlationId: string,
  ): Promise<AdminMasterDataItem> {
    const type = this.assertMasterDataType(rawType);
    const config = getMasterDataTypeConfig(type);
    const existing = await this.findUniqueOrThrow(type, id);

    if (!existing.isActive) {
      return this.mapRecord(type, existing);
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const record = await this.updateRecord(tx, type, id, { isActive: false }, existing);

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.MASTER_DATA_DELETED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'master_data_deleted',
        outcome: AuditOutcome.ALLOWED,
        resourceType: config.resourceType,
        resourceId: record.id,
        companyId:
          config.requiresCompanyId && 'companyId' in record
            ? (record.companyId as string)
            : record.id,
        correlationId,
        idempotencyKey: `master-data-delete:${type}:${record.id}`,
        metadata: {
          master_data_type: type,
          code: record.code,
        },
      });

      return record;
    });

    return this.mapRecord(type, deleted);
  }

  private parseCreateBody(type: MasterDataTypeCode, body: unknown): CreateBody {
    const schema = this.getCreateSchema(type);
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'İstek gövdesi doğrulanamadı.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  private parseUpdateBody(type: MasterDataTypeCode, body: unknown): UpdateBody {
    const schema = this.getUpdateSchema(type);
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'İstek gövdesi doğrulanamadı.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return result.data;
  }

  private getCreateSchema(type: MasterDataTypeCode): ZodType<CreateBody> {
    return (
      type === MasterDataType.COMPANY
        ? createCompanyMasterDataBodySchema
        : createScopedMasterDataBodySchema
    ) as ZodType<CreateBody>;
  }

  private getUpdateSchema(type: MasterDataTypeCode): ZodType<UpdateBody> {
    return (
      type === MasterDataType.COMPANY
        ? updateCompanyMasterDataBodySchema
        : updateScopedMasterDataBodySchema
    ) as ZodType<UpdateBody>;
  }

  private isScopedUpdateBody(body: UpdateBody): body is UpdateScopedMasterDataBody {
    return 'companyId' in body;
  }

  private buildListWhere(
    type: MasterDataTypeCode,
    query: ListAdminMasterDataQuery,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (!query.includeInactive) {
      where.isActive = true;
    }

    if (query.companyId !== undefined) {
      where.companyId = query.companyId;
    }

    if (query.search !== undefined) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (type === MasterDataType.COMPANY && query.companyId !== undefined) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Şirket listesi companyId filtresi desteklemez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return where;
  }

  private async assertActiveCompany(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, isActive: true },
    });

    if (!company) {
      throw new DomainException(
        ErrorCode.ADMIN_MASTER_DATA_COMPANY_NOT_FOUND,
        'Şirket bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!company.isActive) {
      throw new DomainException(
        ErrorCode.MASTER_DATA_INACTIVE,
        'Seçilen kayıt aktif değil.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async assertCodeAvailable(
    type: MasterDataTypeCode,
    code: string,
    options: { companyId?: string; excludeId?: string },
  ): Promise<void> {
    const existing = await this.findByCode(type, code, options.companyId);

    if (existing && existing.id !== options.excludeId) {
      throw new DomainException(
        ErrorCode.ADMIN_MASTER_DATA_CODE_CONFLICT,
        'Bu kod zaten kullanılıyor.',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async findByCode(type: MasterDataTypeCode, code: string, companyId?: string) {
    switch (type) {
      case MasterDataType.COMPANY:
        return this.prisma.company.findUnique({ where: { code } });
      case MasterDataType.LOCATION:
        if (!companyId) {
          return null;
        }
        return this.prisma.location.findUnique({
          where: { companyId_code: { companyId, code } },
        });
      case MasterDataType.FUNCTION:
        if (!companyId) {
          return null;
        }
        return this.prisma.function.findUnique({
          where: { companyId_code: { companyId, code } },
        });
      case MasterDataType.POSITION:
        if (!companyId) {
          return null;
        }
        return this.prisma.position.findUnique({
          where: { companyId_code: { companyId, code } },
        });
      default:
        return null;
    }
  }

  private async findMany(
    type: MasterDataTypeCode,
    args: {
      where: Record<string, unknown>;
      orderBy: Array<Record<string, 'asc' | 'desc'>>;
      take: number;
      cursor?: { id: string };
      skip?: number;
      include?: { company: { select: { name: true } } };
    },
  ) {
    switch (type) {
      case MasterDataType.COMPANY:
        return this.prisma.company.findMany(args as Prisma.CompanyFindManyArgs);
      case MasterDataType.LOCATION:
        return this.prisma.location.findMany(args);
      case MasterDataType.FUNCTION:
        return this.prisma.function.findMany(args);
      case MasterDataType.POSITION:
        return this.prisma.position.findMany(args);
      default:
        return [];
    }
  }

  private async findUniqueOrThrow(type: MasterDataTypeCode, id: string) {
    const record = await this.findUnique(type, id);

    if (!record) {
      throw new DomainException(
        ErrorCode.ADMIN_MASTER_DATA_NOT_FOUND,
        'Master data kaydı bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    return record;
  }

  private async findUnique(type: MasterDataTypeCode, id: string) {
    const include = { company: { select: { name: true } } };

    switch (type) {
      case MasterDataType.COMPANY:
        return this.prisma.company.findUnique({ where: { id } });
      case MasterDataType.LOCATION:
        return this.prisma.location.findUnique({ where: { id }, include });
      case MasterDataType.FUNCTION:
        return this.prisma.function.findUnique({ where: { id }, include });
      case MasterDataType.POSITION:
        return this.prisma.position.findUnique({ where: { id }, include });
      default:
        return null;
    }
  }

  private async createRecord(
    tx: Prisma.TransactionClient,
    type: MasterDataTypeCode,
    body: CreateBody,
  ) {
    switch (type) {
      case MasterDataType.COMPANY:
        return tx.company.create({
          data: {
            name: body.name,
            code: body.code,
            isActive: body.isActive,
            sourceSystem: 'admin_manual',
          },
        });
      case MasterDataType.LOCATION: {
        const scoped = body as CreateScopedMasterDataBody;
        return tx.location.create({
          data: {
            companyId: scoped.companyId,
            name: scoped.name,
            code: scoped.code,
            isActive: scoped.isActive,
            sourceSystem: 'admin_manual',
          },
          include: { company: { select: { name: true } } },
        });
      }
      case MasterDataType.FUNCTION: {
        const scoped = body as CreateScopedMasterDataBody;
        return tx.function.create({
          data: {
            companyId: scoped.companyId,
            name: scoped.name,
            code: scoped.code,
            isActive: scoped.isActive,
            sourceSystem: 'admin_manual',
          },
          include: { company: { select: { name: true } } },
        });
      }
      case MasterDataType.POSITION: {
        const scoped = body as CreateScopedMasterDataBody;
        return tx.position.create({
          data: {
            companyId: scoped.companyId,
            name: scoped.name,
            code: scoped.code,
            isActive: scoped.isActive,
            sourceSystem: 'admin_manual',
          },
          include: { company: { select: { name: true } } },
        });
      }
      default:
        throw new DomainException(
          ErrorCode.ADMIN_MASTER_DATA_TYPE_INVALID,
          'Geçersiz master data tipi.',
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  private async updateRecord(
    tx: Prisma.TransactionClient,
    type: MasterDataTypeCode,
    id: string,
    body: UpdateBody,
    existing: Awaited<ReturnType<typeof this.findUniqueOrThrow>>,
  ) {
    const data = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...('companyId' in body && body.companyId !== undefined ? { companyId: body.companyId } : {}),
    };

    switch (type) {
      case MasterDataType.COMPANY:
        return tx.company.update({ where: { id }, data });
      case MasterDataType.LOCATION:
        return tx.location.update({
          where: { id },
          data,
          include: { company: { select: { name: true } } },
        });
      case MasterDataType.FUNCTION:
        return tx.function.update({
          where: { id },
          data,
          include: { company: { select: { name: true } } },
        });
      case MasterDataType.POSITION:
        return tx.position.update({
          where: { id },
          data,
          include: { company: { select: { name: true } } },
        });
      default:
        return existing;
    }
  }

  private mapRecord(
    type: MasterDataTypeCode,
    record: Awaited<ReturnType<typeof this.findUniqueOrThrow>>,
  ): AdminMasterDataItem {
    const companyName =
      typeof record === 'object' &&
      'company' in record &&
      record.company &&
      typeof record.company === 'object' &&
      'name' in record.company
        ? (record.company.name as string)
        : null;

    return toAdminMasterDataItem(type, record, companyName);
  }
}
