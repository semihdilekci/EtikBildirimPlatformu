import { SlaUnit, TaskType } from '@ethics/shared';
import { describe, expect, it, vi } from 'vitest';

import { SlaCalculatorService } from '../sla/sla-calculator.service.js';
import type { BusinessCalendarService } from '../sla/business-calendar.service.js';

describe('SlaCalculatorService (unit)', () => {
  it('CALENDAR_HOURS biriminde dueAt hesaplar', async () => {
    const assignedAt = new Date('2026-06-01T08:00:00.000Z');
    const client = {
      slaPolicyConfig: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'policy-hours',
          slaDuration: 24,
          slaUnit: SlaUnit.CALENDAR_HOURS,
        }),
      },
    };

    const businessCalendar = {
      buildLookupForBusinessDaySpan: vi.fn(),
      addBusinessDays: vi.fn(),
    } as unknown as BusinessCalendarService;

    const service = new SlaCalculatorService(businessCalendar);
    const result = await service.calculateDueAt(
      client as never,
      TaskType.SECRETARIAT_REVIEW_TASK,
      assignedAt,
    );

    expect(result.slaPolicyId).toBe('policy-hours');
    expect(result.dueAt.getTime()).toBe(assignedAt.getTime() + 24 * 60 * 60 * 1000);
  });

  it('aktif politika yoksa SLA_POLICY_NOT_FOUND fırlatır', async () => {
    const client = {
      slaPolicyConfig: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const businessCalendar = {} as BusinessCalendarService;
    const service = new SlaCalculatorService(businessCalendar);

    await expect(
      service.calculateDueAt(client as never, TaskType.SECRETARIAT_REVIEW_TASK, new Date()),
    ).rejects.toMatchObject({ code: 'SLA_POLICY_NOT_FOUND' });
  });

  it('geçersiz SLA biriminde hata fırlatır', async () => {
    const assignedAt = new Date('2026-06-01T08:00:00.000Z');
    const client = {
      slaPolicyConfig: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'policy-invalid',
          slaDuration: 5,
          slaUnit: 'INVALID_UNIT',
        }),
      },
    };

    const businessCalendar = {} as BusinessCalendarService;
    const service = new SlaCalculatorService(businessCalendar);

    await expect(
      service.calculateDueAt(client as never, TaskType.SECRETARIAT_REVIEW_TASK, assignedAt),
    ).rejects.toMatchObject({ code: 'SLA_POLICY_NOT_FOUND' });
  });
});
