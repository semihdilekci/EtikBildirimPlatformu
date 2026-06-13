import { describe, expect, it } from 'vitest';

import { Role, ROLE_VALUES } from '@ethics/shared';

import {
  CaseField,
  FIELD_VISIBILITY_DEFAULTS,
  FieldVisibility,
  PermissionCode,
  PERMISSION_CODE_VALUES,
  ROLE_PERMISSION_MAP,
  getClearanceRank,
  getFieldVisibility,
  isClearanceSufficient,
  resolveEffectiveAbacRule,
  roleHasPermission,
  rolesHavePermission,
} from '../index.js';
import { PolicyResourceType } from '../abac-rules.js';

describe('PermissionCode', () => {
  it('should define all MVP permissions without placeholder gaps', () => {
    expect(PERMISSION_CODE_VALUES.length).toBeGreaterThanOrEqual(20);
    expect(PERMISSION_CODE_VALUES).toContain(PermissionCode.CASE_LIST);
    expect(PERMISSION_CODE_VALUES).toContain(PermissionCode.ADMIN_MANAGE_ROLES);
    expect(new Set(PERMISSION_CODE_VALUES).size).toBe(PERMISSION_CODE_VALUES.length);
  });

  it('should use resource:action format for every permission', () => {
    for (const permission of PERMISSION_CODE_VALUES) {
      expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });
});

describe('ROLE_PERMISSION_MAP', () => {
  it('should define permissions for every role', () => {
    for (const role of ROLE_VALUES) {
      expect(ROLE_PERMISSION_MAP[role].size).toBeGreaterThan(0);
    }
  });

  it.each(ROLE_VALUES)(
    'should have at least one granted and one denied permission for role %s',
    (role) => {
      const granted = [...ROLE_PERMISSION_MAP[role]];
      const denied = PERMISSION_CODE_VALUES.filter((p) => !ROLE_PERMISSION_MAP[role].has(p));

      expect(granted.length).toBeGreaterThan(0);
      expect(denied.length).toBeGreaterThan(0);
    },
  );

  it('should deny admin case transitions per §3.5 matrix', () => {
    expect(roleHasPermission(Role.ADMIN, PermissionCode.CASE_TRANSITION)).toBe(false);
    expect(roleHasPermission(Role.ADMIN, PermissionCode.ADMIN_MANAGE_ROLES)).toBe(true);
  });

  it('should allow council_secretary assign rapporteur exclusively among council roles', () => {
    expect(roleHasPermission(Role.COUNCIL_SECRETARY, PermissionCode.CASE_ASSIGN_RAPPORTEUR)).toBe(
      true,
    );
    expect(roleHasPermission(Role.COUNCIL_CHAIR, PermissionCode.CASE_ASSIGN_RAPPORTEUR)).toBe(
      false,
    );
  });

  it('should allow only council_secretary secure message access', () => {
    expect(roleHasPermission(Role.COUNCIL_SECRETARY, PermissionCode.SECURE_MESSAGE_READ)).toBe(
      true,
    );
    expect(roleHasPermission(Role.COUNCIL_CHAIR, PermissionCode.SECURE_MESSAGE_READ)).toBe(false);
  });

  it('should resolve multi-role permission as union', () => {
    expect(
      rolesHavePermission([Role.COUNCIL_MEMBER, Role.ADMIN], PermissionCode.ADMIN_MANAGE_ROLES),
    ).toBe(true);
    expect(
      rolesHavePermission([Role.COUNCIL_MEMBER, Role.ADMIN], PermissionCode.SECURE_MESSAGE_WRITE),
    ).toBe(false);
  });
});

describe('ABAC clearance hierarchy', () => {
  it('should rank NORMAL < SENSITIVE < STRICTLY_CONFIDENTIAL', () => {
    expect(getClearanceRank('NORMAL')).toBeLessThan(getClearanceRank('SENSITIVE'));
    expect(getClearanceRank('SENSITIVE')).toBeLessThan(getClearanceRank('STRICTLY_CONFIDENTIAL'));
  });

  it('should deny NORMAL user access to SENSITIVE resource', () => {
    expect(isClearanceSufficient('NORMAL', 'SENSITIVE')).toBe(false);
    expect(isClearanceSufficient('STRICTLY_CONFIDENTIAL', 'SENSITIVE')).toBe(true);
  });
});

describe('ROLE_RESOURCE_ABAC_RULES', () => {
  it('should scope rapporteur to assignment on cases', () => {
    const rule = resolveEffectiveAbacRule([Role.RAPPORTEUR], PolicyResourceType.CASE);
    expect(rule?.denyAll).not.toBe(true);
    expect(rule?.scopes).toContain('assignment_scope');
  });

  it('should scope action_owner to company on cases', () => {
    const rule = resolveEffectiveAbacRule([Role.ACTION_OWNER], PolicyResourceType.CASE);
    expect(rule?.scopes).toContain('company_scope');
  });

  it('should deny admin task and document queries', () => {
    expect(resolveEffectiveAbacRule([Role.ADMIN], PolicyResourceType.TASK)?.denyAll).toBe(true);
    expect(resolveEffectiveAbacRule([Role.ADMIN], PolicyResourceType.DOCUMENT)?.denyAll).toBe(true);
  });

  it('should allow admin case metadata scope without deny-all', () => {
    const rule = resolveEffectiveAbacRule([Role.ADMIN], PolicyResourceType.CASE);
    expect(rule?.denyAll).not.toBe(true);
  });
});

describe('FIELD_VISIBILITY_DEFAULTS', () => {
  it('should hide all content fields from admin per §3.6', () => {
    const adminVisibility = FIELD_VISIBILITY_DEFAULTS[Role.ADMIN];
    expect(adminVisibility[CaseField.CASE_METADATA]).toBe(FieldVisibility.METADATA_ONLY);
    expect(adminVisibility[CaseField.REPORT_TEXT]).toBe(FieldVisibility.HIDDEN);
    expect(adminVisibility[CaseField.SECURE_MESSAGES]).toBe(FieldVisibility.HIDDEN);
  });

  it('should allow council_secretary full secure_messages visibility', () => {
    expect(getFieldVisibility(Role.COUNCIL_SECRETARY, CaseField.SECURE_MESSAGES)).toBe(
      FieldVisibility.VISIBLE,
    );
  });

  it('should restrict action_owner to own action fields only', () => {
    expect(getFieldVisibility(Role.ACTION_OWNER, CaseField.ACTION_LETTER)).toBe(
      FieldVisibility.OWN_ONLY,
    );
    expect(getFieldVisibility(Role.ACTION_OWNER, CaseField.REPORT_TEXT)).toBe(
      FieldVisibility.HIDDEN,
    );
  });

  it('should hide reporter_identity from council_member', () => {
    expect(getFieldVisibility(Role.COUNCIL_MEMBER, CaseField.REPORTER_IDENTITY)).toBe(
      FieldVisibility.HIDDEN,
    );
  });
});
