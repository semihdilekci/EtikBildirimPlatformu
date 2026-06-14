import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { DEFAULT_SLA_POLICIES } from '@ethics/shared';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

import { seedNotificationTemplates } from '../modules/notification/notification-template.seed.js';

export interface PostgresTestEnvironment {
  prisma: PrismaClient;
  databaseUrl: string;
  teardown: () => Promise<void>;
}

async function seedDefaultSlaPolicies(prisma: PrismaClient): Promise<void> {
  for (const policy of DEFAULT_SLA_POLICIES) {
    await prisma.slaPolicyConfig.upsert({
      where: { taskType: policy.taskType },
      create: {
        taskType: policy.taskType,
        slaDuration: policy.slaDuration,
        slaUnit: policy.slaUnit,
        warningThresholdHours: policy.warningThresholdHours,
        escalationRole: policy.escalationRole,
      },
      update: {
        slaDuration: policy.slaDuration,
        slaUnit: policy.slaUnit,
        isActive: true,
      },
    });
  }
}

export async function createPostgresTestEnvironment(): Promise<PostgresTestEnvironment> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('ethics_test')
    .withUsername('ethics')
    .withPassword('ethics_test_password')
    .start();

  const databaseUrl = container.getConnectionUri();
  const apiRoot = resolve(process.cwd());

  execSync('pnpm exec prisma migrate deploy --schema=prisma/schema.prisma', {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  await seedDefaultSlaPolicies(prisma);
  await seedNotificationTemplates(prisma);

  return {
    prisma,
    databaseUrl,
    async teardown() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
