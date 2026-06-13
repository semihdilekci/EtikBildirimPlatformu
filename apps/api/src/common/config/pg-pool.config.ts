import type { PoolConfig } from 'pg';

function normalizeDatabaseUrl(databaseUrl: string): string {
  return databaseUrl.replace(/^postgresql:/, 'postgres:');
}

function toPostgresqlUrl(url: URL): string {
  return url.toString().replace(/^postgres:/, 'postgresql:');
}

function resolvePgSsl(
  databaseUrl: string,
  nodeEnv: string,
): { connectionString: string; ssl?: boolean | { rejectUnauthorized: boolean } } {
  try {
    const url = new URL(normalizeDatabaseUrl(databaseUrl));
    const sslMode = url.searchParams.get('sslmode');
    const usesSsl = sslMode !== null && sslMode !== 'disable';

    if (usesSsl) {
      // pg-connection-string maps require/verify-ca to verify-full, which breaks local RDS dev.
      url.searchParams.delete('sslmode');
    }

    const connectionString = toPostgresqlUrl(url);

    if (!usesSsl) {
      return { connectionString };
    }

    return {
      connectionString,
      ssl: nodeEnv === 'production' ? true : { rejectUnauthorized: false },
    };
  } catch {
    return { connectionString: databaseUrl };
  }
}

export function buildPgPoolConfig(databaseUrl: string, nodeEnv: string): PoolConfig {
  const { connectionString, ssl } = resolvePgSsl(databaseUrl, nodeEnv);

  const config: PoolConfig = { connectionString };

  if (ssl !== undefined) {
    config.ssl = ssl;
  }

  return config;
}
