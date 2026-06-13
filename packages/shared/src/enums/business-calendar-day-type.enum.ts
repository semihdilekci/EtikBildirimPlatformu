/** İş günü takvimi gün tipi — Docs/02_DATABASE_SCHEMA §business_calendar_entries */
export const BusinessCalendarDayType = {
  WORKDAY: 'WORKDAY',
  WEEKEND: 'WEEKEND',
  OFFICIAL_HOLIDAY: 'OFFICIAL_HOLIDAY',
  COMPANY_HOLIDAY: 'COMPANY_HOLIDAY',
  HALF_DAY: 'HALF_DAY',
} as const;

export type BusinessCalendarDayTypeCode =
  (typeof BusinessCalendarDayType)[keyof typeof BusinessCalendarDayType];

export const BUSINESS_CALENDAR_DAY_TYPE_VALUES = Object.values(
  BusinessCalendarDayType,
) as readonly BusinessCalendarDayTypeCode[];
