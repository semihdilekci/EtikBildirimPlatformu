import { ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../../common/types/authenticated-user.type.js';
import { createDefaultActionMatrixConfigService } from '../action-matrix-config.service.js';
import { MakerCheckerService } from '../maker-checker.service.js';

function buildUser(role: Role, id = `user-${role}`): AuthenticatedUser {
  return {
    id,
    email: `${role}@ethics.local`,
    displayName: role,
    roles: [role],
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: false,
  };
}

describe('MakerCheckerService', () => {
  const service = new MakerCheckerService(createDefaultActionMatrixConfigService());

  it('maker ve checker aynı kişi → MAKER_CHECKER_SELF', () => {
    const admin = buildUser(Role.ADMIN, 'same-user');

    expect(() =>
      service.assertChecker(
        admin,
        'same-user',
        service.resolveRoleAssignmentAction(Role.COUNCIL_MEMBER),
      ),
    ).toThrow(expect.objectContaining({ code: ErrorCode.MAKER_CHECKER_SELF }));
  });

  it('council_member checker rol atamasını onaylayamaz', () => {
    const checker = buildUser(Role.COUNCIL_MEMBER, 'checker-1');

    expect(() =>
      service.assertChecker(
        checker,
        'maker-1',
        service.resolveRoleAssignmentAction(Role.COUNCIL_MEMBER),
      ),
    ).toThrow(expect.objectContaining({ code: ErrorCode.MAKER_CHECKER_FORBIDDEN }));
  });

  it('admin maker olarak rol ataması başlatabilir', () => {
    const maker = buildUser(Role.ADMIN, 'maker-1');

    expect(() =>
      service.assertMaker(maker, service.resolveRoleAssignmentAction(Role.COUNCIL_MEMBER)),
    ).not.toThrow();
  });

  it('council_secretary varsayılan rol atamasını onaylayabilir', () => {
    const checker = buildUser(Role.COUNCIL_SECRETARY, 'checker-2');

    expect(() =>
      service.assertChecker(
        checker,
        'maker-2',
        service.resolveRoleAssignmentAction(Role.COUNCIL_MEMBER),
      ),
    ).not.toThrow();
  });
});
