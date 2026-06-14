/** Runtime system setting metadata — Docs/06 S-ADMIN-SYSTEM-SETTINGS */
export const SystemSettingValueType = {
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  STRING: 'string',
  JSON: 'json',
} as const;

export type SystemSettingValueTypeCode =
  (typeof SystemSettingValueType)[keyof typeof SystemSettingValueType];

export interface SystemSettingDefinition {
  key: string;
  category: string;
  description: string;
  unit: string | null;
  valueType: SystemSettingValueTypeCode;
  min?: number;
  max?: number;
  mutable: boolean;
}

export const SYSTEM_SETTING_DEFINITIONS: readonly SystemSettingDefinition[] = [
  {
    key: 'brute_force_max_attempts',
    category: 'brute_force',
    description: 'Maksimum başarısız giriş denemesi',
    unit: 'adet',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 20,
    mutable: true,
  },
  {
    key: 'brute_force_lockout_minutes',
    category: 'brute_force',
    description: 'Brute-force kilitleme süresi',
    unit: 'dk',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 1440,
    mutable: true,
  },
  {
    key: 'session_idle_timeout_minutes',
    category: 'session',
    description: 'Oturum boşta kalma zaman aşımı',
    unit: 'dk',
    valueType: SystemSettingValueType.NUMBER,
    min: 5,
    max: 120,
    mutable: true,
  },
  {
    key: 'session_absolute_timeout_hours',
    category: 'session',
    description: 'Oturum mutlak zaman aşımı',
    unit: 'saat',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 24,
    mutable: true,
  },
  {
    key: 'rate_limit_login_per_minute',
    category: 'rate_limit',
    description: 'Login rate limit',
    unit: 'istek/dk',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 1000,
    mutable: true,
  },
  {
    key: 'rate_limit_intake_per_minute',
    category: 'rate_limit',
    description: 'Intake rate limit',
    unit: 'istek/dk',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 1000,
    mutable: true,
  },
  {
    key: 'rate_limit_tracking_per_minute',
    category: 'rate_limit',
    description: 'Tracking rate limit',
    unit: 'istek/dk',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 1000,
    mutable: true,
  },
  {
    key: 'rate_limit_upload_per_minute',
    category: 'rate_limit',
    description: 'Upload rate limit',
    unit: 'istek/dk',
    valueType: SystemSettingValueType.NUMBER,
    min: 1,
    max: 1000,
    mutable: true,
  },
  {
    key: 'role_catalog',
    category: 'auth_cache',
    description: 'Rol katalog snapshot',
    unit: null,
    valueType: SystemSettingValueType.JSON,
    mutable: false,
  },
  {
    key: 'permission_catalog',
    category: 'auth_cache',
    description: 'Permission katalog snapshot',
    unit: null,
    valueType: SystemSettingValueType.JSON,
    mutable: false,
  },
] as const;

const DEFINITION_BY_KEY = new Map(
  SYSTEM_SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getSystemSettingDefinition(key: string): SystemSettingDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function isKnownSystemSettingKey(key: string): boolean {
  return DEFINITION_BY_KEY.has(key);
}
