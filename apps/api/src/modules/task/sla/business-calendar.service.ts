import { Inject, Injectable } from '@nestjs/common';
import type { BusinessCalendarDayTypeCode } from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  addBusinessDays,
  resolveBusinessDayWeight,
  toIstanbulDateKey,
  type BusinessCalendarLookup,
} from './business-calendar.util.js';

type CalendarClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class BusinessCalendarService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadActiveEntriesForRange(
    startDate: Date,
    endDate: Date,
    client: CalendarClient = this.prisma,
  ): Promise<BusinessCalendarLookup> {
    const entries = await client.businessCalendarEntry.findMany({
      where: {
        isActive: true,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        dayType: true,
      },
    });

    const lookup: BusinessCalendarLookup = new Map();

    for (const entry of entries) {
      lookup.set(toIstanbulDateKey(entry.date), entry.dayType as BusinessCalendarDayTypeCode);
    }

    return lookup;
  }

  async getBusinessDayWeight(date: Date, client: CalendarClient = this.prisma): Promise<number> {
    const lookup = await this.loadActiveEntriesForRange(date, date, client);
    const dateKey = toIstanbulDateKey(date);
    return resolveBusinessDayWeight(dateKey, lookup.get(dateKey) ?? null);
  }

  async buildLookupForBusinessDaySpan(
    assignmentTime: Date,
    businessDays: number,
    client: CalendarClient = this.prisma,
  ): Promise<BusinessCalendarLookup> {
    const calendarSpan = Math.max(Math.ceil(businessDays * 2) + 14, 30);
    const start = new Date(assignmentTime);
    const end = new Date(assignmentTime);
    end.setUTCDate(end.getUTCDate() + calendarSpan);

    return this.loadActiveEntriesForRange(start, end, client);
  }

  addBusinessDays(
    assignmentTime: Date,
    businessDays: number,
    calendarLookup: BusinessCalendarLookup,
  ): Date {
    return addBusinessDays(assignmentTime, businessDays, calendarLookup);
  }
}
