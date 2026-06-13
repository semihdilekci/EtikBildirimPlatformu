import { ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
import { PermissionCode } from '@ethics/policy';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { PolicyGuardService } from '../policy-guard.service.js';

describe('PolicyGuardService', () => {
  const service = new PolicyGuardService();

  const councilSecretary: AuthenticatedUser = {
    id: 'user-cs-1',
    email: 'cs@example.com',
    displayName: 'Council Secretary',
    roles: [Role.COUNCIL_SECRETARY],
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: true,
  };

  const rolelessUser: AuthenticatedUser = {
    id: 'user-roleless',
    email: 'jit@example.com',
    displayName: 'JIT User',
    roles: [],
    clearanceLevel: ClearanceLevel.NORMAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: false,
  };

  const superadmin: AuthenticatedUser = {
    id: 'user-admin',
    email: 'superadmin@ethics.local',
    displayName: 'Platform Superadmin',
    roles: [Role.ADMIN],
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: true,
  };

  it('council_secretary case:list permission ile geçer', () => {
    expect(service.evaluate(councilSecretary, PermissionCode.CASE_LIST)).toEqual({ allowed: true });
  });

  it('rolsüz kullanıcı case:list için rbac_denied döner', () => {
    expect(service.evaluate(rolelessUser, PermissionCode.CASE_LIST)).toEqual({
      allowed: false,
      reason: 'rbac_denied',
    });
  });

  it('superadmin admin:manage_roles ile geçer', () => {
    expect(service.evaluate(superadmin, PermissionCode.ADMIN_MANAGE_ROLES)).toEqual({
      allowed: true,
    });
  });

  it('superadmin case:transition için rbac_denied döner', () => {
    expect(service.evaluate(superadmin, PermissionCode.CASE_TRANSITION)).toEqual({
      allowed: false,
      reason: 'rbac_denied',
    });
  });

  it('clearance yetersizse clearance_denied döner', () => {
    const normalClearanceUser: AuthenticatedUser = {
      ...councilSecretary,
      clearanceLevel: ClearanceLevel.NORMAL,
    };

    expect(
      service.evaluate(normalClearanceUser, PermissionCode.CASE_READ, {
        resourceClearanceLevel: ClearanceLevel.SENSITIVE,
      }),
    ).toEqual({ allowed: false, reason: 'clearance_denied' });
  });

  it('assertAllowed rbac reddinde AUTHZ_FORBIDDEN fırlatır', () => {
    expect(() => service.assertAllowed(rolelessUser, PermissionCode.CASE_LIST)).toThrow(
      DomainException,
    );

    try {
      service.assertAllowed(rolelessUser, PermissionCode.CASE_LIST);
    } catch (error) {
      expect((error as DomainException).code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
      expect((error as DomainException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('maskAsNotFound ile clearance reddinde AUTHZ_NOT_FOUND döner', () => {
    const normalUser: AuthenticatedUser = {
      ...councilSecretary,
      clearanceLevel: ClearanceLevel.NORMAL,
    };

    try {
      service.assertAllowed(normalUser, PermissionCode.CASE_READ, {
        resourceClearanceLevel: ClearanceLevel.SENSITIVE,
        maskAsNotFound: true,
      });
    } catch (error) {
      expect((error as DomainException).code).toBe(ErrorCode.AUTHZ_NOT_FOUND);
      expect((error as DomainException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });
});
