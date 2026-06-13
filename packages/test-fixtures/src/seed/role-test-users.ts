import { ClearanceLevel, Role, type Role as RoleCode } from '@ethics/shared';
import type { PrismaClient } from '@prisma/client';

export const SYNTHETIC_SEED_COMPANY = {
  code: 'SEED-CO',
  name: 'Sentetik Seed Şirketi',
} as const;

export interface RoleTestUserDefinition {
  role: RoleCode;
  email: string;
  displayName: string;
  oidcSubjectId: string;
  clearanceLevel: string;
  isGeneralSecretary?: boolean;
  attachSeedCompany?: boolean;
}

/** Her internal rol için sentetik test kullanıcısı — Docs/07 §3.5, Faz 2 İterasyon 6 */
export const ROLE_TEST_USER_DEFINITIONS: readonly RoleTestUserDefinition[] = [
  {
    role: Role.ADMIN,
    email: 'superadmin@ethics.local',
    displayName: 'Platform Superadmin',
    oidcSubjectId: 'seed-superadmin-oidc-sub',
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    isGeneralSecretary: true,
  },
  {
    role: Role.COUNCIL_SECRETARY,
    email: 'council.secretary@ethics.local',
    displayName: 'Seed Council Secretary',
    oidcSubjectId: 'seed-council-secretary-oidc-sub',
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    isGeneralSecretary: true,
  },
  {
    role: Role.COUNCIL_CHAIR,
    email: 'council.chair@ethics.local',
    displayName: 'Seed Council Chair',
    oidcSubjectId: 'seed-council-chair-oidc-sub',
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
  },
  {
    role: Role.COUNCIL_MEMBER,
    email: 'council.member@ethics.local',
    displayName: 'Seed Council Member',
    oidcSubjectId: 'seed-council-member-oidc-sub',
    clearanceLevel: ClearanceLevel.SENSITIVE,
  },
  {
    role: Role.BOARD_CHAIR,
    email: 'board.chair@ethics.local',
    displayName: 'Seed Board Chair',
    oidcSubjectId: 'seed-board-chair-oidc-sub',
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
  },
  {
    role: Role.RAPPORTEUR,
    email: 'rapporteur@ethics.local',
    displayName: 'Seed Rapporteur',
    oidcSubjectId: 'seed-rapporteur-oidc-sub',
    clearanceLevel: ClearanceLevel.SENSITIVE,
  },
  {
    role: Role.ACTION_OWNER,
    email: 'action.owner@ethics.local',
    displayName: 'Seed Action Owner',
    oidcSubjectId: 'seed-action-owner-oidc-sub',
    clearanceLevel: ClearanceLevel.NORMAL,
    attachSeedCompany: true,
  },
] as const;

export interface SeedRoleTestUsersResult {
  companyId: string | null;
  usersByRole: Partial<Record<RoleCode, { id: string; email: string }>>;
}

export async function seedSyntheticCompany(prisma: PrismaClient): Promise<string> {
  const company = await prisma.company.upsert({
    where: { code: SYNTHETIC_SEED_COMPANY.code },
    create: {
      code: SYNTHETIC_SEED_COMPANY.code,
      name: SYNTHETIC_SEED_COMPANY.name,
      sourceSystem: 'seed',
      sourceRecordId: 'seed-company-001',
    },
    update: {
      name: SYNTHETIC_SEED_COMPANY.name,
      isActive: true,
    },
  });

  return company.id;
}

export async function seedRoleTestUsers(
  prisma: PrismaClient,
  options: { superadminOidcSub?: string } = {},
): Promise<SeedRoleTestUsersResult> {
  const companyId = await seedSyntheticCompany(prisma);
  const usersByRole: Partial<Record<RoleCode, { id: string; email: string }>> = {};

  for (const definition of ROLE_TEST_USER_DEFINITIONS) {
    const oidcSubjectId =
      definition.role === Role.ADMIN && options.superadminOidcSub
        ? options.superadminOidcSub
        : definition.oidcSubjectId;

    const user = await prisma.user.upsert({
      where: { email: definition.email },
      create: {
        email: definition.email,
        displayName: definition.displayName,
        oidcSubjectId,
        clearanceLevel: definition.clearanceLevel,
        isGeneralSecretary: definition.isGeneralSecretary ?? false,
        companyId: definition.attachSeedCompany ? companyId : null,
        provisionedAt: new Date(),
      },
      update: {
        displayName: definition.displayName,
        oidcSubjectId,
        clearanceLevel: definition.clearanceLevel,
        isGeneralSecretary: definition.isGeneralSecretary ?? false,
        companyId: definition.attachSeedCompany ? companyId : null,
        isActive: true,
      },
    });

    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleCode: definition.role,
        isActive: true,
      },
    });

    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleCode: definition.role,
          assignedBy: user.id,
          reason: 'Faz 2 seed — rol bazlı test kullanıcısı',
        },
      });
    }

    usersByRole[definition.role] = { id: user.id, email: user.email };
  }

  return { companyId, usersByRole };
}
