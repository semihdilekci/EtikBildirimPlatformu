/** SLA süre birimi — Docs/02_DATABASE_SCHEMA §sla_policy_configs */
export const SlaUnit = {
  CALENDAR_HOURS: 'calendar_hours',
  BUSINESS_DAYS: 'business_days',
} as const;

export type SlaUnitCode = (typeof SlaUnit)[keyof typeof SlaUnit];

export const SLA_UNIT_VALUES = Object.values(SlaUnit) as readonly SlaUnitCode[];
