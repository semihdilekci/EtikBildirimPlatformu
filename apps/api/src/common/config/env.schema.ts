import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

const envInputSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positiveInt.default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    OIDC_ISSUER_URL: z.string().url().optional(),
    OIDC_ISSUER: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    OIDC_CALLBACK_URL: z.string().url().optional(),
    OIDC_REDIRECT_URI: z.string().url().optional(),

    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
    SESSION_STORE_TABLE: z.string().min(1).default('user_sessions'),
    SESSION_ABSOLUTE_TIMEOUT_HOURS: positiveInt.default(8),

    WEB_APP_URL: z.string().url().default('http://localhost:5173'),
    CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

    IP_HASH_PEPPER: z.string().min(16).default('dev-ip-hash-pepper-change-me'),
    BRUTE_FORCE_MAX_ATTEMPTS: positiveInt.default(5),
    BRUTE_FORCE_LOCKOUT_MINUTES: positiveInt.default(15),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((input) => {
    const oidcIssuerUrl = input.OIDC_ISSUER_URL ?? input.OIDC_ISSUER;
    const oidcCallbackUrl = input.OIDC_CALLBACK_URL ?? input.OIDC_REDIRECT_URI;

    if (!oidcIssuerUrl) {
      throw new Error('Invalid environment configuration: OIDC_ISSUER_URL is required');
    }

    if (!oidcCallbackUrl) {
      throw new Error('Invalid environment configuration: OIDC_CALLBACK_URL is required');
    }

    return {
      NODE_ENV: input.NODE_ENV,
      PORT: input.PORT,
      DATABASE_URL: input.DATABASE_URL,
      OIDC_ISSUER_URL: oidcIssuerUrl,
      OIDC_CLIENT_ID: input.OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET: input.OIDC_CLIENT_SECRET,
      OIDC_CALLBACK_URL: oidcCallbackUrl,
      SESSION_SECRET: input.SESSION_SECRET,
      CSRF_SECRET: input.CSRF_SECRET,
      SESSION_STORE_TABLE: input.SESSION_STORE_TABLE,
      SESSION_ABSOLUTE_TIMEOUT_HOURS: input.SESSION_ABSOLUTE_TIMEOUT_HOURS,
      WEB_APP_URL: input.WEB_APP_URL,
      CORS_ALLOWED_ORIGINS: input.CORS_ALLOWED_ORIGINS,
      IP_HASH_PEPPER: input.IP_HASH_PEPPER,
      BRUTE_FORCE_MAX_ATTEMPTS: input.BRUTE_FORCE_MAX_ATTEMPTS,
      BRUTE_FORCE_LOCKOUT_MINUTES: input.BRUTE_FORCE_LOCKOUT_MINUTES,
      LOG_LEVEL: input.LOG_LEVEL,
    };
  });

export type EnvConfig = z.infer<typeof envInputSchema>;

export function validateEnv(raw: NodeJS.ProcessEnv = process.env): EnvConfig {
  const result = envInputSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
