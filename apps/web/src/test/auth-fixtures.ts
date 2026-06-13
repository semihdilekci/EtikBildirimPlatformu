import type { AuthMeResponse } from '@ethics/dto';
import { ClearanceLevel, Role, type Role as RoleCode } from '@ethics/shared';

export function buildAuthMeUser(roles: readonly RoleCode[]): AuthMeResponse {
  return {
    id: 'user-test-001',
    email: 'test.user@ethics.local',
    displayName: 'Test User',
    roles: [...roles],
    clearanceLevel: ClearanceLevel.NORMAL,
    companyId: null,
    companyName: null,
    isGeneralSecretary: roles.includes(Role.COUNCIL_SECRETARY),
    sessionExpiresAt: new Date('2030-01-01T00:00:00.000Z').toISOString(),
  };
}
