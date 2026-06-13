import { AUDIT_FORBIDDEN_METADATA_KEYS } from '@ethics/shared';

const FORBIDDEN_KEY_SET = new Set<string>(AUDIT_FORBIDDEN_METADATA_KEYS);

export function findForbiddenAuditMetadataKey(value: unknown, path = ''): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childPath = path ? `${path}[${String(index)}]` : `[${String(index)}]`;
      const match = findForbiddenAuditMetadataKey(value[index], childPath);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (FORBIDDEN_KEY_SET.has(key)) {
        return path ? `${path}.${key}` : key;
      }

      const childPath = path ? `${path}.${key}` : key;
      const match = findForbiddenAuditMetadataKey(nestedValue, childPath);
      if (match) {
        return match;
      }
    }
  }

  return undefined;
}
