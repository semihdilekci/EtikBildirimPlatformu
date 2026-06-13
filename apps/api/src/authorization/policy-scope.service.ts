import type { ClearanceLevel } from '@ethics/shared';
import {
  AbacScopeType,
  getAllowedClearanceLevels,
  PolicyResourceType,
  resolveEffectiveAbacRule,
} from '@ethics/policy';
import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../common/types/authenticated-user.type.js';
import { buildDenyAllWhere } from './policy-scope.constants.js';
import type { CaseWhereInput, TaskWhereInput } from './policy-scope.types.js';

type ScopeBuildResult = CaseWhereInput | TaskWhereInput | 'DENY';

@Injectable()
export class PolicyScopeService {
  getAllowedLevels(clearance: ClearanceLevel): readonly ClearanceLevel[] {
    return getAllowedClearanceLevels(clearance);
  }

  buildCaseScope(user: AuthenticatedUser): CaseWhereInput {
    return this.buildResourceScope(user, PolicyResourceType.CASE, (scopes) =>
      this.buildCaseAbacConditions(user, scopes),
    );
  }

  buildTaskScope(user: AuthenticatedUser): TaskWhereInput {
    return this.buildResourceScope(user, PolicyResourceType.TASK, (scopes) =>
      this.buildTaskAbacConditions(user, scopes),
    );
  }

  private buildResourceScope(
    user: AuthenticatedUser,
    resource: PolicyResourceType,
    buildAbac: (scopes: readonly AbacScopeType[]) => ScopeBuildResult,
  ): CaseWhereInput | TaskWhereInput {
    if (user.roles.length === 0) {
      return buildDenyAllWhere();
    }

    const rule = resolveEffectiveAbacRule(user.roles, resource);

    if (!rule || rule.denyAll) {
      return buildDenyAllWhere();
    }

    const conditions: Array<CaseWhereInput | TaskWhereInput> = [
      this.buildClearanceCondition(resource, user.clearanceLevel),
    ];

    const abacResult = buildAbac(rule.scopes);
    if (abacResult === 'DENY') {
      return buildDenyAllWhere();
    }

    if (Object.keys(abacResult).length > 0) {
      conditions.push(abacResult);
    }

    if (conditions.length === 1) {
      const first = conditions[0];
      if (first !== undefined) {
        return first;
      }
    }

    return { AND: conditions };
  }

  private buildClearanceCondition(
    resource: PolicyResourceType,
    clearance: ClearanceLevel,
  ): CaseWhereInput | TaskWhereInput {
    const allowedLevels = this.getAllowedLevels(clearance);

    if (resource === PolicyResourceType.TASK) {
      return {
        case: {
          confidentialityLevel: { in: allowedLevels },
        },
      };
    }

    return {
      confidentialityLevel: { in: allowedLevels },
    };
  }

  private buildCaseAbacConditions(
    user: AuthenticatedUser,
    scopes: readonly AbacScopeType[],
  ): CaseWhereInput | 'DENY' {
    const conditions: CaseWhereInput[] = [];

    if (scopes.includes(AbacScopeType.ASSIGNMENT)) {
      conditions.push({ assignedRapporteurId: user.id });
    }

    if (scopes.includes(AbacScopeType.COMPANY)) {
      if (!user.companyId) {
        return 'DENY';
      }
      conditions.push({ companyId: user.companyId });
    }

    if (scopes.includes(AbacScopeType.FUNCTION_LOCATION)) {
      const functionLocationCondition = this.buildCaseFunctionLocationCondition(user);
      if (functionLocationCondition === 'DENY') {
        return 'DENY';
      }
      conditions.push(functionLocationCondition);
    }

    return this.mergeConditions(conditions);
  }

  private buildTaskAbacConditions(
    user: AuthenticatedUser,
    scopes: readonly AbacScopeType[],
  ): TaskWhereInput | 'DENY' {
    const conditions: TaskWhereInput[] = [];

    if (scopes.includes(AbacScopeType.ASSIGNMENT)) {
      conditions.push({ assignedUserId: user.id });
    }

    if (scopes.includes(AbacScopeType.COMPANY)) {
      if (!user.companyId) {
        return 'DENY';
      }
      conditions.push({ assignedCompanyId: user.companyId });
    }

    if (scopes.includes(AbacScopeType.FUNCTION_LOCATION)) {
      if (!user.functionId) {
        return 'DENY';
      }
      conditions.push({ assignedFunctionId: user.functionId });
    }

    return this.mergeConditions(conditions);
  }

  /**
   * Case tablosunda function/location kolonu henüz yok (Faz 5).
   * Org sınırı companyId üzerinden uygulanır; schema genişleyince doğrudan kolon filtresine geçilir.
   */
  private buildCaseFunctionLocationCondition(user: AuthenticatedUser): CaseWhereInput | 'DENY' {
    if (!user.companyId) {
      return 'DENY';
    }

    return { companyId: user.companyId };
  }

  private mergeConditions(conditions: CaseWhereInput[]): CaseWhereInput;
  private mergeConditions(conditions: TaskWhereInput[]): TaskWhereInput;
  private mergeConditions(
    conditions: Array<CaseWhereInput | TaskWhereInput>,
  ): CaseWhereInput | TaskWhereInput {
    if (conditions.length === 0) {
      return {};
    }

    if (conditions.length === 1) {
      const first = conditions[0];
      if (first !== undefined) {
        return first;
      }
    }

    return { AND: conditions };
  }
}
