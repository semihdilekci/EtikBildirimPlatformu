import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | undefined;

export function createPrismaClient(databaseUrl = process.env['DATABASE_URL']): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for worker Prisma client');
  }

  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }
  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = undefined;
  }
}
