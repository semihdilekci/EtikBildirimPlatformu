export const SYSTEM_SETTING_GROUP_LABELS: Readonly<Record<string, string>> = {
  auth_cache: 'Yetki & Cache',
  rate_limit: 'Rate Limiting',
  brute_force: 'Brute-Force',
  session: 'Session',
  sla: 'SLA',
  worker: 'Worker/Job',
};

export function getSystemSettingGroupLabel(group: string): string {
  return SYSTEM_SETTING_GROUP_LABELS[group] ?? group;
}

export const SYSTEM_SETTING_GROUP_ORDER = [
  'auth_cache',
  'rate_limit',
  'brute_force',
  'session',
  'sla',
  'worker',
] as const;
