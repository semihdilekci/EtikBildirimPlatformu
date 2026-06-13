import { ClearanceLevel, Role } from '@ethics/shared';
import { PermissionCode, roleHasPermission } from '@ethics/policy';
import { ROLE_TEST_USER_DEFINITIONS, seedRoleTestUsers } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PolicyScopeService } from '../policy-scope.service.js';
import { PolicyGuardService } from '../policy-guard.service.js';
import { isDenyAllWhere } from '../policy-scope.constants.js';
import { EnvService } from '../../common/config/env.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../test/postgres-test-environment.js';
import { AuthService } from '../../modules/auth/auth.service.js';

describe('Authorization DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let authService: AuthService;
  let policyScopeService: PolicyScopeService;
  let policyGuardService: PolicyGuardService;
  let seedCompanyId: string;

  const envService = {
    webAppUrl: 'http://localhost:5173',
    corsAllowedOrigins: ['http://localhost:5173'],
    oidcIssuerUrl: 'https://accounts.google.com',
    isProduction: false,
  } as EnvService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    authService = new AuthService(environment.prisma as never, envService);
    policyScopeService = new PolicyScopeService();
    policyGuardService = new PolicyGuardService();

    const seedResult = await seedRoleTestUsers(environment.prisma);
    seedCompanyId = seedResult.companyId ?? '';
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it.each(ROLE_TEST_USER_DEFINITIONS)(
    'seed kullanıcısı $role rolü ve clearance ile yüklenir',
    async (definition) => {
      const dbUser = await environment.prisma.user.findUnique({
        where: { email: definition.email },
        include: {
          rolesAssigned: { where: { isActive: true } },
        },
      });

      expect(dbUser).not.toBeNull();
      if (!dbUser) {
        return;
      }
      expect(dbUser.clearanceLevel).toBe(definition.clearanceLevel);

      const activeRoles = dbUser.rolesAssigned.map((item) => item.roleCode);
      expect(activeRoles).toContain(definition.role);

      const loaded = await authService.loadAuthenticatedUser(dbUser.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.roles).toContain(definition.role);
      expect(loaded?.clearanceLevel).toBe(definition.clearanceLevel);

      if (definition.attachSeedCompany) {
        expect(loaded?.companyId).toBe(seedCompanyId);
      }
    },
  );

  it('rolsüz JIT kullanıcı loadAuthenticatedUser sonrası boş rol seti döner', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const provisioned = await authService.provisionUserFromOidc({
      sub: `jit-authz-${suffix}`,
      email: `jit.authz.${suffix}@ethics.local`,
      name: `JIT Authz ${suffix}`,
    });

    const loaded = await authService.loadAuthenticatedUser(provisioned.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.roles).toEqual([]);

    if (!loaded) {
      return;
    }

    expect(policyGuardService.evaluate(loaded, PermissionCode.CASE_LIST).allowed).toBe(false);
  });

  it('action_owner yanlış şirket vakalarını PolicyScope ile filtreler', async () => {
    const owner = await authService.loadAuthenticatedUser(
      (
        await environment.prisma.user.findUniqueOrThrow({
          where: { email: 'action.owner@ethics.local' },
        })
      ).id,
    );

    expect(owner).not.toBeNull();
    expect(owner?.companyId).toBe(seedCompanyId);

    if (!owner) {
      return;
    }

    const scope = policyScopeService.buildCaseScope(owner);
    expect(isDenyAllWhere(scope)).toBe(false);

    const mockCases = [
      { id: 'own-case', confidentialityLevel: ClearanceLevel.NORMAL, companyId: seedCompanyId },
      {
        id: 'other-case',
        confidentialityLevel: ClearanceLevel.NORMAL,
        companyId: 'other-company-id',
      },
    ];

    const visibleIds = mockCases
      .filter((item) => matchesCompanyScope(item, scope))
      .map((item) => item.id);

    expect(visibleIds).toEqual(['own-case']);
  });

  it('NORMAL clearance council_secretary SENSITIVE vaka clearance kontrolünde reddedilir', async () => {
    const secretary = await authService.loadAuthenticatedUser(
      (
        await environment.prisma.user.findUniqueOrThrow({
          where: { email: 'council.secretary@ethics.local' },
        })
      ).id,
    );

    expect(secretary).not.toBeNull();

    if (!secretary) {
      return;
    }

    const normalClearanceUser = {
      ...secretary,
      clearanceLevel: ClearanceLevel.NORMAL,
    };

    const evaluation = policyGuardService.evaluate(normalClearanceUser, PermissionCode.CASE_READ, {
      resourceClearanceLevel: ClearanceLevel.SENSITIVE,
    });

    expect(evaluation).toEqual({ allowed: false, reason: 'clearance_denied' });
  });

  it('admin rolü case:transition permission için rbac_denied alır', async () => {
    const admin = await authService.loadAuthenticatedUser(
      (
        await environment.prisma.user.findUniqueOrThrow({
          where: { email: 'superadmin@ethics.local' },
        })
      ).id,
    );

    expect(admin).not.toBeNull();
    expect(roleHasPermission(Role.ADMIN, PermissionCode.CASE_TRANSITION)).toBe(false);

    if (!admin) {
      return;
    }

    expect(policyGuardService.evaluate(admin, PermissionCode.CASE_TRANSITION)).toEqual({
      allowed: false,
      reason: 'rbac_denied',
    });
  });
});

type MockScopedCase = {
  id: string;
  confidentialityLevel: ClearanceLevel;
  companyId?: string;
};

function matchesCompanyScope(
  item: MockScopedCase,
  scope: ReturnType<PolicyScopeService['buildCaseScope']>,
): boolean {
  if (isDenyAllWhere(scope)) {
    return false;
  }

  if (scope.AND) {
    return scope.AND.every((condition) => matchesCompanyScope(item, condition));
  }

  if (
    scope.confidentialityLevel?.in &&
    !scope.confidentialityLevel.in.includes(item.confidentialityLevel)
  ) {
    return false;
  }

  if (scope.companyId !== undefined && scope.companyId !== item.companyId) {
    return false;
  }

  return true;
}
