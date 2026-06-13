/** Prisma sorgusunda hiçbir kayıtla eşleşmeyen sentinel — deny-by-default scope */
export const POLICY_DENY_ALL_ID = '__POLICY_DENY_ALL__' as const;

export function buildDenyAllWhere(): { id: typeof POLICY_DENY_ALL_ID } {
  return { id: POLICY_DENY_ALL_ID };
}

export function isDenyAllWhere(where: { id?: string | { equals?: string } }): boolean {
  if (typeof where.id === 'string') {
    return where.id === POLICY_DENY_ALL_ID;
  }

  if (where.id && typeof where.id === 'object' && 'equals' in where.id) {
    return where.id.equals === POLICY_DENY_ALL_ID;
  }

  return false;
}
