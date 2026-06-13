import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

const DEV_LOCAL_FIELD_KEK = Buffer.from('ethics-dev-local-field-kek-v01!!').toString('base64');
const DEV_LOCAL_DOCUMENT_KEK = Buffer.from('ethics-dev-local-doc-kek-v01!!!!').toString('base64');

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
    LOG_REDACTION_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    CRYPTO_KEY_MANAGEMENT_PROVIDER: z.enum(['local', 'kms']).default('local'),
    CRYPTO_LOCAL_KEK_FIELD: z.string().optional(),
    CRYPTO_LOCAL_KEK_DOCUMENT: z.string().optional(),
    AWS_KMS_KEY_ALIAS_FIELD: z.string().optional(),
    AWS_KMS_KEY_ALIAS_DOCUMENT: z.string().optional(),
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

    const cryptoKeyManagementProvider = input.CRYPTO_KEY_MANAGEMENT_PROVIDER;
    const isNonProduction = input.NODE_ENV === 'development' || input.NODE_ENV === 'test';

    const cryptoLocalKekField =
      input.CRYPTO_LOCAL_KEK_FIELD ??
      (cryptoKeyManagementProvider === 'local' && isNonProduction
        ? DEV_LOCAL_FIELD_KEK
        : undefined);

    const cryptoLocalKekDocument =
      input.CRYPTO_LOCAL_KEK_DOCUMENT ??
      (cryptoKeyManagementProvider === 'local' && isNonProduction
        ? DEV_LOCAL_DOCUMENT_KEK
        : undefined);

    if (cryptoKeyManagementProvider === 'local') {
      if (!cryptoLocalKekField || !cryptoLocalKekDocument) {
        throw new Error(
          'Invalid environment configuration: CRYPTO_LOCAL_KEK_FIELD and CRYPTO_LOCAL_KEK_DOCUMENT are required when CRYPTO_KEY_MANAGEMENT_PROVIDER=local',
        );
      }
    }

    if (cryptoKeyManagementProvider === 'kms') {
      if (!input.AWS_KMS_KEY_ALIAS_FIELD || !input.AWS_KMS_KEY_ALIAS_DOCUMENT) {
        throw new Error(
          'Invalid environment configuration: AWS_KMS_KEY_ALIAS_FIELD and AWS_KMS_KEY_ALIAS_DOCUMENT are required when CRYPTO_KEY_MANAGEMENT_PROVIDER=kms',
        );
      }
    }

    if (input.NODE_ENV === 'production' && cryptoKeyManagementProvider === 'local') {
      throw new Error(
        'Invalid environment configuration: CRYPTO_KEY_MANAGEMENT_PROVIDER=local is not allowed in production',
      );
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
      LOG_REDACTION_ENABLED: input.LOG_REDACTION_ENABLED,
      CRYPTO_KEY_MANAGEMENT_PROVIDER: cryptoKeyManagementProvider,
      CRYPTO_LOCAL_KEK_FIELD: cryptoLocalKekField,
      CRYPTO_LOCAL_KEK_DOCUMENT: cryptoLocalKekDocument,
      AWS_KMS_KEY_ALIAS_FIELD: input.AWS_KMS_KEY_ALIAS_FIELD,
      AWS_KMS_KEY_ALIAS_DOCUMENT: input.AWS_KMS_KEY_ALIAS_DOCUMENT,
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
