import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { DEFAULT_NOTIFICATION_TEMPLATES } from '@ethics/shared';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

export interface PostgresTestEnvironment {
  prisma: PrismaClient;
  databaseUrl: string;
  teardown: () => Promise<void>;
}

async function seedNotificationTemplates(prisma: PrismaClient): Promise<void> {
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { templateCode: template.templateCode },
      create: {
        templateCode: template.templateCode,
        name: template.name,
        channel: template.channel,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: template.isActive,
        versionNo: 1,
      },
      update: {
        name: template.name,
        channel: template.channel,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: template.isActive,
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
  const apiRoot = resolve(process.cwd(), '../api');

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
