import {
  CASE_FIELD_VALUES,
  CaseField,
  FIELD_VISIBILITY_DEFAULTS,
  FieldVisibility,
} from '@ethics/policy';
import { ROLE_VALUES, type Role as RoleCode } from '@ethics/shared';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

function cloneDefaultsMatrix(): Record<RoleCode, Record<CaseField, FieldVisibility>> {
  const matrix = {} as Record<RoleCode, Record<CaseField, FieldVisibility>>;

  for (const role of ROLE_VALUES) {
    matrix[role] = { ...FIELD_VISIBILITY_DEFAULTS[role] };
  }

  return matrix;
}

@Injectable()
export class FieldVisibilityPolicyService implements OnModuleInit {
  private matrix: Record<RoleCode, Record<CaseField, FieldVisibility>> = cloneDefaultsMatrix();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const overrides = await this.prisma.fieldVisibilityConfig.findMany({
      where: { isActive: true },
    });

    const matrix = cloneDefaultsMatrix();

    for (const config of overrides) {
      const role = config.roleCode as RoleCode;
      const field = config.fieldName as CaseField;

      if (!ROLE_VALUES.includes(role) || !CASE_FIELD_VALUES.includes(field)) {
        continue;
      }

      matrix[role][field] = config.visibility as FieldVisibility;
    }

    this.matrix = matrix;
  }

  getMatrixSnapshot(): Record<RoleCode, Record<CaseField, FieldVisibility>> {
    return this.matrix;
  }

  getFieldVisibility(role: RoleCode, field: CaseField): FieldVisibility {
    return this.matrix[role][field];
  }

  resolveFieldVisibilityForRoles(roles: readonly RoleCode[], field: CaseField): FieldVisibility {
    if (roles.length === 0) {
      return FieldVisibility.HIDDEN;
    }

    const visibilities = roles.map((role) => this.getFieldVisibility(role, field));

    if (visibilities.includes(FieldVisibility.VISIBLE)) {
      return FieldVisibility.VISIBLE;
    }
    if (visibilities.includes(FieldVisibility.OWN_ONLY)) {
      return FieldVisibility.OWN_ONLY;
    }
    if (visibilities.includes(FieldVisibility.METADATA_ONLY)) {
      return FieldVisibility.METADATA_ONLY;
    }

    return FieldVisibility.HIDDEN;
  }
}

/** Test ortamı için DB'siz varsayılan matris servisi */
export function createDefaultFieldVisibilityPolicyService(): FieldVisibilityPolicyService {
  return new FieldVisibilityPolicyService(null as unknown as PrismaService);
}
