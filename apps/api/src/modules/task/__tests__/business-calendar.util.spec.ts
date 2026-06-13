import { BusinessCalendarDayType, DEFAULT_SLA_POLICIES } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import {
  addBusinessDays,
  addCalendarDays,
  buildDueAtFromDateKey,
  getDefaultDayType,
  parseIstanbulDateKey,
  resolveBusinessDayWeight,
  toIstanbulDateKey,
} from '../sla/business-calendar.util.js';

describe('business-calendar.util', () => {
  it('hafta sonu varsayılan olarak iş günü sayılmaz', () => {
    expect(getDefaultDayType('2025-01-04')).toBe(BusinessCalendarDayType.WEEKEND);
    expect(getDefaultDayType('2025-01-05')).toBe(BusinessCalendarDayType.WEEKEND);
    expect(resolveBusinessDayWeight('2025-01-04', null)).toBe(0);
  });

  it('hafta içi varsayılan tam iş günüdür', () => {
    expect(getDefaultDayType('2025-01-06')).toBe(BusinessCalendarDayType.WORKDAY);
    expect(resolveBusinessDayWeight('2025-01-06', null)).toBe(1);
  });

  it('resmi tatil kaydı iş günü ağırlığını sıfırlar', () => {
    expect(resolveBusinessDayWeight('2025-01-02', BusinessCalendarDayType.OFFICIAL_HOLIDAY)).toBe(
      0,
    );
  });

  it('holding tatili iş günü ağırlığını sıfırlar', () => {
    expect(resolveBusinessDayWeight('2025-01-07', BusinessCalendarDayType.COMPANY_HOLIDAY)).toBe(0);
  });

  it('yarım gün 0.5 ağırlıkla sayılır', () => {
    expect(resolveBusinessDayWeight('2025-12-31', BusinessCalendarDayType.HALF_DAY)).toBe(0.5);
  });

  it('3 iş günü hesabında hafta sonu atlanır', () => {
    const assignment = new Date('2025-01-03T10:00:00+03:00');
    const dueAt = addBusinessDays(assignment, 3, new Map());

    expect(toIstanbulDateKey(dueAt)).toBe('2025-01-07');
  });

  it('3 iş günü hesabında araya giren resmi tatil atlanır', () => {
    const assignment = new Date('2025-01-02T10:00:00+03:00');
    const lookup = new Map<string, typeof BusinessCalendarDayType.OFFICIAL_HOLIDAY>([
      ['2025-01-02', BusinessCalendarDayType.OFFICIAL_HOLIDAY],
    ]);

    const dueAt = addBusinessDays(assignment, 3, lookup);

    expect(toIstanbulDateKey(dueAt)).toBe('2025-01-07');
  });

  it('1 iş günü SLA yarım gün + tam gün kombinasyonunda ertesi tam güne uzar', () => {
    const assignment = new Date('2025-12-31T09:00:00+03:00');
    const lookup = new Map([['2025-12-31', BusinessCalendarDayType.HALF_DAY]] as const);

    const dueAt = addBusinessDays(assignment, 1, lookup);

    expect(toIstanbulDateKey(dueAt)).toBe('2026-01-01');
  });

  it('atama saati due_at hesabında korunur', () => {
    const assignment = new Date('2025-01-06T14:30:15+03:00');
    const dueAt = buildDueAtFromDateKey('2025-01-08', assignment);

    expect(dueAt.toISOString()).toBe(new Date('2025-01-08T14:30:15+03:00').toISOString());
  });

  it('takvim günü ekleme İstanbul tarih anahtarını korur', () => {
    const base = parseIstanbulDateKey('2025-01-31');
    const shifted = addCalendarDays(base, 1);

    expect(toIstanbulDateKey(shifted)).toBe('2025-02-01');
  });
});

describe('DEFAULT_SLA_POLICIES', () => {
  it('11 görev tipi için politika tanımlıdır', () => {
    expect(DEFAULT_SLA_POLICIES).toHaveLength(11);
  });
});
