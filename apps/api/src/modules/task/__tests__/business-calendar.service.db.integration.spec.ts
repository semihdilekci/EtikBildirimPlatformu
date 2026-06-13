import { BusinessCalendarDayType } from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { BusinessCalendarService } from '../sla/business-calendar.service.js';

describe('BusinessCalendarService integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let calendarService: BusinessCalendarService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    calendarService = new BusinessCalendarService(environment.prisma as unknown as PrismaService);
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('getBusinessDayWeight yarım gün için 0.5 döner', async () => {
    const halfDay = new Date('2026-07-15T09:00:00.000Z');

    await environment.prisma.businessCalendarEntry.create({
      data: {
        date: halfDay,
        dayType: BusinessCalendarDayType.HALF_DAY,
        description: 'Yarım gün test',
        isActive: true,
      },
    });

    const weight = await calendarService.getBusinessDayWeight(halfDay);
    expect(weight).toBe(0.5);
  });

  it('buildLookupForBusinessDaySpan aktif tatil günlerini yükler', async () => {
    const assignmentTime = new Date('2026-07-01T08:00:00.000Z');
    const holiday = new Date('2026-07-10T00:00:00.000Z');

    await environment.prisma.businessCalendarEntry.create({
      data: {
        date: holiday,
        dayType: BusinessCalendarDayType.OFFICIAL_HOLIDAY,
        description: 'Resmi tatil test',
        isActive: true,
      },
    });

    const lookup = await calendarService.buildLookupForBusinessDaySpan(
      assignmentTime,
      5,
      environment.prisma,
    );

    expect(lookup.size).toBeGreaterThan(0);
  });
});
