import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import pg from 'pg';

import type { EnvService } from '../../../common/config/env.service.js';

export type SessionMiddleware = ReturnType<typeof session>;

export function createPgSessionStore(envService: EnvService): SessionMiddleware {
  const PgSessionStore = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: envService.databaseUrl,
  });

  return session({
    name: 'sid',
    store: new PgSessionStore({
      pool,
      tableName: envService.sessionStoreTable,
      createTableIfMissing: false,
    }),
    secret: envService.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: envService.isProduction,
      sameSite: 'strict',
      maxAge: envService.sessionAbsoluteTimeoutMs,
      path: '/',
    },
  });
}
