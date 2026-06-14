import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  BusinessCalendarEntryDto,
  CreateBusinessCalendarEntryBody,
  DeleteBusinessCalendarEntryBody,
  ListBusinessCalendarQuery,
} from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  BusinessCalendarDayType,
  ErrorCode,
  type BusinessCalendarDayTypeCode,
} from '@ethics/shared';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { parseIstanbulDateKey, toIstanbulDateKey } from '../../task/sla/business-calendar.util.js';

/**
 * MVP recalc policy: Takvim girişi ekleme/silme mevcut açık görevlerin `sla_due_at`
 * alanını otomatik yeniden hesaplamaz. Yeni atanan görevler güncel takvimle hesaplanır.
 */
@Injectable()
export class BusinessCalendarAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
  ) {}

  async listEntries(query: ListBusinessCalendarQuery): Promise<BusinessCalendarEntryDto[]> {
    const fromDate = query.from ? parseIstanbulDateKey(query.from) : undefined;
    const toDate = query.to ? parseIstanbulDateKey(query.to) : undefined;

    const entries = await this.prisma.businessCalendarEntry.findMany({
      where: {
        isActive: true,
        ...(fromDate || toDate
          ? {
              date: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });

    return entries.map((entry) => this.toDto(entry));
  }

  async createEntry(
    actor: AuthenticatedUser,
    body: CreateBusinessCalendarEntryBody,
    correlationId: string,
  ): Promise<BusinessCalendarEntryDto> {
    const date = parseIstanbulDateKey(body.date);
    const dayType = body.dayType as BusinessCalendarDayTypeCode;

    if (
      dayType === BusinessCalendarDayType.WEEKEND ||
      dayType === BusinessCalendarDayType.WORKDAY
    ) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Hafta sonu ve iş günü takvim kaydı eklenemez; bunlar varsayılan davranışla belirlenir.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.prisma.businessCalendarEntry.findUnique({
      where: { date },
    });

    if (existing?.isActive) {
      throw new DomainException(
        ErrorCode.ADMIN_BUSINESS_CALENDAR_DATE_CONFLICT,
        'Bu tarih için zaten aktif bir takvim kaydı var.',
        HttpStatus.CONFLICT,
      );
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.businessCalendarEntry.update({
            where: { id: existing.id },
            data: {
              dayType,
              description: body.description ?? null,
              isActive: true,
              versionNo: { increment: 1 },
              approvedBy: actor.id,
            },
          })
        : await tx.businessCalendarEntry.create({
            data: {
              date,
              dayType,
              description: body.description ?? null,
              approvedBy: actor.id,
            },
          });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.BUSINESS_CALENDAR_UPDATED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'business_calendar_entry_created',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'business_calendar_entry',
        resourceId: saved.id,
        correlationId,
        idempotencyKey: `business-calendar-create:${saved.id}:${String(saved.versionNo)}`,
        metadata: {
          date: body.date,
          day_type: dayType,
          description: body.description ?? null,
          reason: body.reason,
        },
      });

      return saved;
    });

    return this.toDto(entry);
  }

  async deleteEntry(
    actor: AuthenticatedUser,
    entryId: string,
    body: DeleteBusinessCalendarEntryBody,
    correlationId: string,
  ): Promise<BusinessCalendarEntryDto> {
    const entry = await this.prisma.businessCalendarEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || !entry.isActive) {
      throw new DomainException(
        ErrorCode.ADMIN_BUSINESS_CALENDAR_NOT_FOUND,
        'Takvim kaydı bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const deactivated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.businessCalendarEntry.update({
        where: { id: entry.id },
        data: {
          isActive: false,
          versionNo: { increment: 1 },
          approvedBy: actor.id,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.BUSINESS_CALENDAR_UPDATED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'business_calendar_entry_deleted',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'business_calendar_entry',
        resourceId: saved.id,
        correlationId,
        idempotencyKey: `business-calendar-delete:${saved.id}:${String(saved.versionNo)}`,
        metadata: {
          date: toIstanbulDateKey(saved.date),
          day_type: saved.dayType,
          reason: body.reason,
        },
      });

      return saved;
    });

    return this.toDto(deactivated);
  }

  private toDto(entry: {
    id: string;
    date: Date;
    dayType: string;
    description: string | null;
    updatedAt: Date;
  }): BusinessCalendarEntryDto {
    return {
      id: entry.id,
      date: toIstanbulDateKey(entry.date),
      dayType: entry.dayType,
      description: entry.description,
      updatedAt: entry.updatedAt.toISOString(),
    };
  }
}
