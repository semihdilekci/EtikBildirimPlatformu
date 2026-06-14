import type { Prisma } from '@prisma/client';
import {
  getSystemSettingDefinition,
  SystemSettingValueType,
  type SystemSettingDefinition,
} from '@ethics/shared';
import type { SystemSettingListItem, SystemSettingValue } from '@ethics/dto';

type SystemSettingRow = {
  key: string;
  value: Prisma.JsonValue;
  category: string;
  updatedAt: Date;
  approvedBy: string | null;
};

type PendingBatchByKey = Map<string, string>;

export function serializeSettingValue(value: Prisma.JsonValue): SystemSettingValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (typeof value === 'object' && value !== null)
  ) {
    return value;
  }

  return String(value);
}

export function toSystemSettingListItem(
  setting: SystemSettingRow,
  pendingBatchByKey: PendingBatchByKey,
): SystemSettingListItem {
  const definition = getSystemSettingDefinition(setting.key);

  return {
    key: setting.key,
    value: serializeSettingValue(setting.value),
    group: setting.category,
    description: definition?.description ?? setting.key,
    unit: definition?.unit ?? null,
    valueType: definition?.valueType ?? SystemSettingValueType.JSON,
    mutable: definition?.mutable ?? false,
    updatedAt: setting.updatedAt.toISOString(),
    updatedBy: setting.approvedBy,
    pendingBatchId: pendingBatchByKey.get(setting.key) ?? null,
  };
}

export function valuesEqual(left: Prisma.JsonValue, right: SystemSettingValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateSettingValue(
  definition: SystemSettingDefinition,
  value: SystemSettingValue,
): string | null {
  if (!definition.mutable) {
    return 'Bu parametre değiştirilemez.';
  }

  switch (definition.valueType) {
    case SystemSettingValueType.NUMBER: {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'Sayısal bir değer girilmelidir.';
      }

      if (definition.min !== undefined && value < definition.min) {
        return `Değer en az ${String(definition.min)} olmalıdır.`;
      }

      if (definition.max !== undefined && value > definition.max) {
        return `Değer en fazla ${String(definition.max)} olmalıdır.`;
      }

      return null;
    }
    case SystemSettingValueType.BOOLEAN: {
      return typeof value === 'boolean' ? null : 'Boolean bir değer girilmelidir.';
    }
    case SystemSettingValueType.STRING: {
      return typeof value === 'string' && value.length > 0 ? null : 'Metin değer girilmelidir.';
    }
    default:
      return 'Bu parametre tipi desteklenmiyor.';
  }
}
