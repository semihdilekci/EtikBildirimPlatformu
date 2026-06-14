import { BusinessCalendarDayType, type BusinessCalendarDayTypeCode } from '@ethics/shared';

export const BUSINESS_CALENDAR_DAY_TYPE_LABELS: Readonly<
  Record<BusinessCalendarDayTypeCode, string>
> = {
  [BusinessCalendarDayType.WORKDAY]: 'İş Günü',
  [BusinessCalendarDayType.WEEKEND]: 'Hafta Sonu',
  [BusinessCalendarDayType.OFFICIAL_HOLIDAY]: 'Resmi Tatil',
  [BusinessCalendarDayType.COMPANY_HOLIDAY]: 'Holding Tatili',
  [BusinessCalendarDayType.HALF_DAY]: 'Yarım Gün',
};

export function getBusinessCalendarDayTypeLabel(dayType: BusinessCalendarDayTypeCode): string {
  return BUSINESS_CALENDAR_DAY_TYPE_LABELS[dayType];
}

export const ADDABLE_BUSINESS_CALENDAR_DAY_TYPES: readonly BusinessCalendarDayTypeCode[] = [
  BusinessCalendarDayType.OFFICIAL_HOLIDAY,
  BusinessCalendarDayType.COMPANY_HOLIDAY,
  BusinessCalendarDayType.HALF_DAY,
];

export function getBusinessCalendarDayColor(dayType: BusinessCalendarDayTypeCode): string {
  switch (dayType) {
    case BusinessCalendarDayType.OFFICIAL_HOLIDAY:
      return 'error.main';
    case BusinessCalendarDayType.COMPANY_HOLIDAY:
      return 'warning.main';
    case BusinessCalendarDayType.HALF_DAY:
      return 'warning.light';
    case BusinessCalendarDayType.WEEKEND:
      return 'action.disabled';
    default:
      return 'transparent';
  }
}
