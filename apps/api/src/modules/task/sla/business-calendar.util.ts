import { BusinessCalendarDayType, type BusinessCalendarDayTypeCode } from '@ethics/shared';

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';
const ISTANBUL_UTC_OFFSET = '+03:00';

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** İstanbul takvim günü — YYYY-MM-DD */
export function toIstanbulDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ISTANBUL_TIME_ZONE }).format(date);
}

export function parseIstanbulDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00${ISTANBUL_UTC_OFFSET}`);
}

export function addCalendarDays(date: Date, days: number): Date {
  const dateKey = toIstanbulDateKey(date);
  const parts = dateKey.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 9, 0, 0));
  return shifted;
}

export function getIstanbulWeekdayIndex(dateKey: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ISTANBUL_TIME_ZONE,
    weekday: 'long',
  }).format(parseIstanbulDateKey(dateKey));

  return WEEKDAY_INDEX[weekday] ?? 0;
}

export function getDefaultDayType(dateKey: string): BusinessCalendarDayTypeCode {
  const weekday = getIstanbulWeekdayIndex(dateKey);
  return weekday === 0 || weekday === 6
    ? BusinessCalendarDayType.WEEKEND
    : BusinessCalendarDayType.WORKDAY;
}

export function resolveEffectiveDayType(
  dateKey: string,
  entryDayType: BusinessCalendarDayTypeCode | null,
): BusinessCalendarDayTypeCode {
  return entryDayType ?? getDefaultDayType(dateKey);
}

/** İş günü ağırlığı: tam gün 1, yarım gün 0.5, tatil/hafta sonu 0 */
export function resolveBusinessDayWeight(
  dateKey: string,
  entryDayType: BusinessCalendarDayTypeCode | null,
): number {
  const effectiveType = resolveEffectiveDayType(dateKey, entryDayType);

  switch (effectiveType) {
    case BusinessCalendarDayType.WORKDAY:
      return 1;
    case BusinessCalendarDayType.HALF_DAY:
      return 0.5;
    default:
      return 0;
  }
}

export function buildDueAtFromDateKey(dateKey: string, assignmentTime: Date): Date {
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(assignmentTime);

  const hour = timeParts.find((part) => part.type === 'hour')?.value ?? '17';
  const minute = timeParts.find((part) => part.type === 'minute')?.value ?? '00';
  const second = timeParts.find((part) => part.type === 'second')?.value ?? '00';

  return new Date(`${dateKey}T${hour}:${minute}:${second}${ISTANBUL_UTC_OFFSET}`);
}

export type BusinessCalendarLookup = Map<string, BusinessCalendarDayTypeCode>;

/**
 * İş günü SLA: atama anından itibaren N iş günü ileri.
 * Yarım gün 0.5 ağırlıkla sayılır; hafta sonu ve tatiller atlanır.
 */
export function addBusinessDays(
  assignmentTime: Date,
  businessDays: number,
  calendarLookup: BusinessCalendarLookup,
): Date {
  if (businessDays <= 0) {
    return assignmentTime;
  }

  let remaining = businessDays;
  let cursor = new Date(assignmentTime);

  while (remaining > 0) {
    const dateKey = toIstanbulDateKey(cursor);
    const weight = resolveBusinessDayWeight(dateKey, calendarLookup.get(dateKey) ?? null);

    if (weight > 0) {
      remaining -= weight;
      if (remaining <= 0) {
        return buildDueAtFromDateKey(dateKey, assignmentTime);
      }
    }

    cursor = addCalendarDays(cursor, 1);
  }

  return buildDueAtFromDateKey(toIstanbulDateKey(cursor), assignmentTime);
}
