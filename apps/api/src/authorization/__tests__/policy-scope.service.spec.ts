import { ClearanceLevel, Role } from '@ethics/shared';
import * as policyModule from '@ethics/policy';
import { AbacScopeType } from '@ethics/policy';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { isDenyAllWhere, POLICY_DENY_ALL_ID } from '../policy-scope.constants.js';
import { PolicyScopeService } from '../policy-scope.service.js';
import type { CaseWhereInput } from '../policy-scope.types.js';

describe('PolicyScopeService', () => {
  const service = new PolicyScopeService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildUser(
    overrides: Partial<AuthenticatedUser> & Pick<AuthenticatedUser, 'roles'>,
  ): AuthenticatedUser {
    return {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      companyId: 'company-1',
      companyName: 'Test Company',
      functionId: 'function-1',
      locationId: 'location-1',
      isGeneralSecretary: false,
      ...overrides,
    };
  }

  describe('getAllowedLevels', () => {
    it('NORMAL clearance yalnızca NORMAL kaynakları kapsar', () => {
      expect(service.getAllowedLevels(ClearanceLevel.NORMAL)).toEqual([ClearanceLevel.NORMAL]);
    });

    it('SENSITIVE clearance NORMAL ve SENSITIVE kapsar', () => {
      expect(service.getAllowedLevels(ClearanceLevel.SENSITIVE)).toEqual([
        ClearanceLevel.NORMAL,
        ClearanceLevel.SENSITIVE,
      ]);
    });

    it('STRICTLY_CONFIDENTIAL tüm seviyeleri kapsar', () => {
      expect(service.getAllowedLevels(ClearanceLevel.STRICTLY_CONFIDENTIAL)).toEqual([
        ClearanceLevel.NORMAL,
        ClearanceLevel.SENSITIVE,
        ClearanceLevel.STRICTLY_CONFIDENTIAL,
      ]);
    });
  });

  describe('buildCaseScope', () => {
    it('rapporteur yalnızca atandığı vakaları görür', () => {
      const user = buildUser({ id: 'rapporteur-1', roles: [Role.RAPPORTEUR] });
      const scope = service.buildCaseScope(user);

      expect(isDenyAllWhere(scope)).toBe(false);
      expect(scope).toEqual({
        AND: [
          { confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) } },
          { assignedRapporteurId: 'rapporteur-1' },
        ],
      });
    });

    it('action_owner yalnızca kendi şirket vakalarını görür', () => {
      const user = buildUser({
        id: 'owner-1',
        roles: [Role.ACTION_OWNER],
        companyId: 'company-abc',
      });
      const scope = service.buildCaseScope(user);

      expect(scope).toEqual({
        AND: [
          { confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) } },
          { companyId: 'company-abc' },
        ],
      });
    });

    it('action_owner başka şirket vakalarını mock listede filtreler', () => {
      const user = buildUser({
        roles: [Role.ACTION_OWNER],
        companyId: 'company-abc',
      });
      const scope = service.buildCaseScope(user);

      const mockCases = [
        { id: 'c-own', confidentialityLevel: ClearanceLevel.NORMAL, companyId: 'company-abc' },
        { id: 'c-other', confidentialityLevel: ClearanceLevel.NORMAL, companyId: 'company-xyz' },
      ];

      expect(filterMockCases(mockCases, scope).map((item) => item.id)).toEqual(['c-own']);
    });

    it('action_owner companyId yoksa deny-all döner', () => {
      const user = buildUser({
        roles: [Role.ACTION_OWNER],
        companyId: null,
      });

      expect(service.buildCaseScope(user)).toEqual({ id: POLICY_DENY_ALL_ID });
    });

    it('action_owner başka şirket vakalarını mock listede filtreler', () => {
      const user = buildUser({
        roles: [Role.ACTION_OWNER],
        companyId: 'company-a',
      });
      const scope = service.buildCaseScope(user);

      const mockCases = [
        { id: 'c1', confidentialityLevel: ClearanceLevel.NORMAL, companyId: 'company-a' },
        { id: 'c2', confidentialityLevel: ClearanceLevel.NORMAL, companyId: 'company-b' },
      ];

      expect(filterMockCases(mockCases, scope).map((item) => item.id)).toEqual(['c1']);
    });

    it('rapporteur atanmadığı vakaları mock listede filtreler', () => {
      const user = buildUser({ id: 'rapporteur-1', roles: [Role.RAPPORTEUR] });
      const scope = service.buildCaseScope(user);

      const mockCases = [
        {
          id: 'c1',
          confidentialityLevel: ClearanceLevel.NORMAL,
          assignedRapporteurId: 'rapporteur-1',
        },
        {
          id: 'c2',
          confidentialityLevel: ClearanceLevel.NORMAL,
          assignedRapporteurId: 'other-rapporteur',
        },
      ];

      expect(filterMockCases(mockCases, scope).map((item) => item.id)).toEqual(['c1']);
    });

    it('board_chair tüm vakaları clearance sınırında görür', () => {
      const user = buildUser({ roles: [Role.BOARD_CHAIR] });
      const scope = service.buildCaseScope(user);

      expect(scope).toEqual({
        confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
      });
    });

    it('council_secretary tüm vakaları clearance sınırında görür', () => {
      const user = buildUser({ roles: [Role.COUNCIL_SECRETARY] });
      const scope = service.buildCaseScope(user);

      expect(scope).toEqual({
        confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
      });
    });

    it('clearance yetersiz kullanıcı STRICTLY_CONFIDENTIAL vakaları filtreler', () => {
      const user = buildUser({
        roles: [Role.COUNCIL_SECRETARY],
        clearanceLevel: ClearanceLevel.NORMAL,
      });
      const scope = service.buildCaseScope(user);

      expect(scope).toEqual({
        confidentialityLevel: { in: [ClearanceLevel.NORMAL] },
      });

      const mockCases = [
        { id: 'c1', confidentialityLevel: ClearanceLevel.NORMAL },
        { id: 'c2', confidentialityLevel: ClearanceLevel.SENSITIVE },
      ];

      const allowed = filterMockCases(mockCases, scope);
      expect(allowed.map((item) => item.id)).toEqual(['c1']);
    });

    it('admin vaka listesinde metadata scope (clearance only) uygular', () => {
      const user = buildUser({ roles: [Role.ADMIN] });
      const scope = service.buildCaseScope(user);

      expect(isDenyAllWhere(scope)).toBe(false);
      expect(scope).toEqual({
        confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
      });
    });

    it('rapporteur + action_owner birleşiminde assignment ve company scope birleşir', () => {
      const user = buildUser({
        id: 'multi-scope-1',
        roles: [Role.RAPPORTEUR, Role.ACTION_OWNER],
        companyId: 'company-multi',
      });
      const scope = service.buildCaseScope(user);

      expect(scope).toEqual({
        AND: [
          { confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) } },
          {
            AND: [{ assignedRapporteurId: 'multi-scope-1' }, { companyId: 'company-multi' }],
          },
        ],
      });
    });

    it('function_location scope companyId yoksa deny-all döner', () => {
      vi.spyOn(policyModule, 'resolveEffectiveAbacRule').mockReturnValueOnce({
        scopes: [AbacScopeType.FUNCTION_LOCATION, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
      });

      const user = buildUser({
        roles: [Role.COUNCIL_MEMBER],
        companyId: null,
      });

      expect(service.buildCaseScope(user)).toEqual({ id: POLICY_DENY_ALL_ID });
    });
  });

  describe('buildTaskScope', () => {
    it('council_chair yalnızca kendine atanan görevleri görür', () => {
      const user = buildUser({ id: 'chair-1', roles: [Role.COUNCIL_CHAIR] });
      const scope = service.buildTaskScope(user);

      expect(scope).toEqual({
        AND: [
          {
            case: {
              confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
            },
          },
          { assignedUserId: 'chair-1' },
        ],
      });
    });

    it('action_owner kendi şirket görevlerini görür', () => {
      const user = buildUser({
        roles: [Role.ACTION_OWNER],
        companyId: 'company-xyz',
      });
      const scope = service.buildTaskScope(user);

      expect(scope).toEqual({
        AND: [
          {
            case: {
              confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
            },
          },
          { assignedCompanyId: 'company-xyz' },
        ],
      });
    });

    it('council_secretary tüm görevleri clearance sınırında görür', () => {
      const user = buildUser({ roles: [Role.COUNCIL_SECRETARY] });
      const scope = service.buildTaskScope(user);

      expect(scope).toEqual({
        case: {
          confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
        },
      });
    });

    it('admin görev sorgularında deny-all döner', () => {
      const user = buildUser({ roles: [Role.ADMIN] });
      expect(service.buildTaskScope(user)).toEqual({ id: POLICY_DENY_ALL_ID });
    });

    it('admin + başka rol birleşiminde görev sorguları deny-all kalır', () => {
      const user = buildUser({ roles: [Role.ADMIN, Role.RAPPORTEUR] });
      expect(service.buildTaskScope(user)).toEqual({ id: POLICY_DENY_ALL_ID });
    });

    it('action_owner companyId yoksa görev sorgularında deny-all döner', () => {
      const user = buildUser({
        roles: [Role.ACTION_OWNER],
        companyId: null,
      });

      expect(service.buildTaskScope(user)).toEqual({ id: POLICY_DENY_ALL_ID });
    });

    it('function_location scope functionId yoksa görev sorgularında deny-all döner', () => {
      vi.spyOn(policyModule, 'resolveEffectiveAbacRule').mockReturnValueOnce({
        scopes: [AbacScopeType.FUNCTION_LOCATION, AbacScopeType.CONFIDENTIALITY_CLEARANCE],
      });

      const user = buildUser({
        roles: [Role.COUNCIL_MEMBER],
        functionId: null,
      });

      expect(service.buildTaskScope(user)).toEqual({ id: POLICY_DENY_ALL_ID });
    });

    it('rapporteur yalnızca atandığı görevleri görür', () => {
      const user = buildUser({ id: 'rapporteur-2', roles: [Role.RAPPORTEUR] });
      const scope = service.buildTaskScope(user);

      expect(scope).toEqual({
        AND: [
          {
            case: {
              confidentialityLevel: { in: service.getAllowedLevels(user.clearanceLevel) },
            },
          },
          { assignedUserId: 'rapporteur-2' },
        ],
      });
    });
  });
});

type MockCase = {
  id: string;
  confidentialityLevel: ClearanceLevel;
  assignedRapporteurId?: string;
  companyId?: string;
};

function filterMockCases(cases: MockCase[], scope: CaseWhereInput): MockCase[] {
  return cases.filter((item) => matchesCaseScope(item, scope));
}

function matchesCaseScope(item: MockCase, scope: CaseWhereInput): boolean {
  if (isDenyAllWhere(scope)) {
    return false;
  }

  if (scope.AND) {
    return scope.AND.every((condition) => matchesCaseScope(item, condition));
  }

  if (scope.OR) {
    return scope.OR.some((condition) => matchesCaseScope(item, condition));
  }

  if (scope.id !== undefined && scope.id !== item.id) {
    return false;
  }

  if (
    scope.confidentialityLevel?.in &&
    !scope.confidentialityLevel.in.includes(item.confidentialityLevel)
  ) {
    return false;
  }

  if (
    scope.assignedRapporteurId !== undefined &&
    scope.assignedRapporteurId !== item.assignedRapporteurId
  ) {
    return false;
  }

  if (scope.companyId !== undefined && scope.companyId !== item.companyId) {
    return false;
  }

  return true;
}
