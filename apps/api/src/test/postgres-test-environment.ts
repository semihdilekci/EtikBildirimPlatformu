import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

export interface PostgresTestEnvironment {
  prisma: PrismaClient;
  databaseUrl: string;
  teardown: () => Promise<void>;
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

  return {
    prisma,
    databaseUrl,
    async teardown() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
