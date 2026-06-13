import { randomUUID } from 'node:crypto';

import { ClearanceLevel, type Role } from '@ethics/shared';
import type { Prisma, PrismaClient, User } from '@prisma/client';

export interface CreateUserInput {
  email?: string;
  displayName?: string;
  oidcSubjectId?: string;
  clearanceLevel?: string;
  isActive?: boolean;
  roles?: Role[];
}

function buildSyntheticEmail(suffix: string): string {
  return `test.user.${suffix}@ethics.local`;
}

function buildSyntheticOidcSub(suffix: string): string {
  return `test-oidc-sub-${suffix}`;
}

export class UserFactory {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateUserInput = {}): Promise<User> {
    const suffix = randomUUID().slice(0, 8);
    const email = input.email ?? buildSyntheticEmail(suffix);
    const oidcSubjectId = input.oidcSubjectId ?? buildSyntheticOidcSub(suffix);

    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: input.displayName ?? `Test User ${suffix}`,
        oidcSubjectId,
        clearanceLevel: input.clearanceLevel ?? ClearanceLevel.NORMAL,
        isActive: input.isActive ?? true,
        provisionedAt: new Date(),
      },
    });

    if (input.roles && input.roles.length > 0) {
      await this.assignRoles(user.id, input.roles);
    }

    return user;
  }

  async assignRoles(userId: string, roles: Role[]): Promise<void> {
    const assignments: Prisma.UserRoleCreateManyInput[] = roles.map((roleCode) => ({
      userId,
      roleCode,
      assignedBy: userId,
      reason: 'Synthetic test fixture assignment',
    }));

    await this.prisma.userRole.createMany({
      data: assignments,
    });
  }
}
