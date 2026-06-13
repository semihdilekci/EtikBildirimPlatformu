import { describe, expect, it } from 'vitest';

import { buildPgPoolConfig } from '../pg-pool.config.js';

describe('buildPgPoolConfig', () => {
  it('sslmode=require için development ortamında rejectUnauthorized false kullanır', () => {
    const config = buildPgPoolConfig(
      'postgresql://user:pass@host.rds.amazonaws.com:5432/db?schema=public&sslmode=require',
      'development',
    );

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config.connectionString).toBe(
      'postgresql://user:pass@host.rds.amazonaws.com:5432/db?schema=public',
    );
  });

  it('sslmode yoksa ssl ayarlamaz', () => {
    const config = buildPgPoolConfig('postgresql://user:pass@localhost:5432/db', 'development');

    expect(config.ssl).toBeUndefined();
  });

  it('production ortamında sslmode=require için ssl true kullanır', () => {
    const config = buildPgPoolConfig(
      'postgresql://user:pass@host.rds.amazonaws.com:5432/db?schema=public&sslmode=require',
      'production',
    );

    expect(config.ssl).toBe(true);
    expect(config.connectionString).not.toContain('sslmode=');
  });
});
