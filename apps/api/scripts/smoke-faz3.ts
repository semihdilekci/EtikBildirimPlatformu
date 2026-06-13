#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Faz 3 Human Gate smoke test.
 * - Varsayılan: canlı API + .env.local DB
 * - --local: Testcontainers (RDS/API erişilemezken)
 *
 * Kullanım: pnpm --filter @ethics/api smoke:faz3 [--local]
 */
import { createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { ClearanceLevel } from '@ethics/shared';
import pg from 'pg';

import { AuditEventPublisher } from '../src/audit/audit-event.publisher.js';
import { AuditSealService } from '../src/audit/audit-seal.service.js';
import { RedactionService } from '../src/audit/redaction.service.js';
import { MASKED_EMAIL, REDACTED_PLACEHOLDER } from '../src/audit/redaction.constants.js';
import { EnvService } from '../src/common/config/env.service.js';
import type { AuthenticatedUser } from '../src/common/types/authenticated-user.type.js';
import { CryptoService } from '../src/crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../src/crypto/key-management.adapter.js';
import { DevCryptoAuditService } from '../src/modules/dev-crypto-audit/dev-crypto-audit.service.js';
import { createPostgresTestEnvironment } from '../src/test/postgres-test-environment.js';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const LOCAL_MODE = process.argv.includes('--local');
const PORT = process.env.PORT ?? '3000';
const API_BASE = `http://127.0.0.1:${PORT}/api/v1`;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');

const testUser: AuthenticatedUser = {
  id: 'smoke-user-1',
  email: 'smoke@ethics.local',
  displayName: 'Smoke User',
  roles: [],
  clearanceLevel: ClearanceLevel.NORMAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

type StepResult = { name: string; ok: boolean; detail: string };
const results: StepResult[] = [];

function pass(name: string, detail: string): void {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}: ${detail}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
  process.exit(1);
}

function signSessionId(sessionId: string, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  return `s:${sessionId}.${signature}`;
}

function parseSetCookie(headers: Headers): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const entry of headers.getSetCookie()) {
    const [pair] = entry.split(';');
    if (pair === undefined) {
      continue;
    }
    const eq = pair.indexOf('=');
    if (eq > 0) {
      cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  return cookies;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function buildEnvService(overrides: Partial<EnvService> = {}): EnvService {
  return {
    isProduction: false,
    logRedactionEnabled: true,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
    ...overrides,
  } as EnvService;
}

function checkRedaction(): void {
  const redaction = new RedactionService(buildEnvService());
  const masked = redaction.redactForLog({
    userEmail: 'alice@example.com',
    password: 'secret123',
    report_text: 'gizli içerik',
  }) as Record<string, string>;

  if (masked.userEmail !== MASKED_EMAIL) {
    fail('pii-redaction', `email maskelenmedi: ${String(masked.userEmail)}`);
  }
  if (masked.password !== '***') {
    fail('pii-redaction', 'password maskelenmedi');
  }
  if (masked.report_text !== REDACTED_PLACEHOLDER) {
    fail('pii-redaction', 'report_text [REDACTED] değil');
  }
  pass('pii-redaction', 'email/password/report_text log çıktısında maskeli');
}

async function checkAppendOnly(pool: pg.Pool): Promise<void> {
  const eventResult = await pool.query<{ id: string }>(
    `SELECT id FROM audit_events ORDER BY created_at DESC LIMIT 1`,
  );

  if (eventResult.rows.length === 0) {
    pass('append-only', 'audit_events boş — worker dispatch sonrası doğrulanır');
    return;
  }

  const eventId = eventResult.rows[0]?.id;
  try {
    await pool.query(`UPDATE audit_events SET action = 'tampered' WHERE id = $1`, [eventId]);
    fail('append-only', 'UPDATE başarılı — trigger çalışmıyor');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('AUDIT_APPEND_ONLY_VIOLATION')) {
      fail('append-only', message);
    }
    pass('append-only', 'UPDATE audit_events → AUDIT_APPEND_ONLY_VIOLATION');
  }
}

async function runLocalSmoke(): Promise<void> {
  console.log('\n=== Faz 3 Smoke Test (Testcontainers — --local) ===\n');

  const environment = await createPostgresTestEnvironment();
  const pool = new pg.Pool({ connectionString: environment.databaseUrl });

  try {
    const keyManagement = new LocalKeyManagementAdapter(buildEnvService());
    const cryptoService = new CryptoService(keyManagement);
    const auditPublisher = new AuditEventPublisher();
    const service = new DevCryptoAuditService(
      buildEnvService(),
      environment.prisma as never,
      cryptoService,
      auditPublisher,
    );

    const correlationId = crypto.randomUUID();
    const plaintext = 'smoke-local-gizli-metin-alice@example.com';

    const result = await service.encryptDemo(
      testUser,
      { plaintext, caseId: 'case-smoke-local' },
      correlationId,
    );

    if (result.ciphertextLength <= 0) {
      fail('encrypt-demo', 'ciphertextLength geçersiz');
    }
    pass('encrypt-demo', `ciphertextLength=${String(result.ciphertextLength)}`);

    const outbox = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId },
    });

    if (!outbox) {
      fail('audit-outbox', 'kayıt bulunamadı');
    }

    const metadataStr = JSON.stringify(outbox.metadataJson ?? {});
    if (metadataStr.includes(plaintext) || metadataStr.includes('alice@example.com')) {
      fail('audit-outbox', 'metadata plaintext sızıntısı');
    }

    pass(
      'audit-outbox',
      `status=${outbox.dispatchStatus}, outcome=${outbox.outcome}, action=${outbox.action}`,
    );

    process.env.DATABASE_URL = environment.databaseUrl;

    const { AuditOutboxDispatchJob } =
      await import('../../worker/src/jobs/audit-outbox-dispatch.job.js');
    const { AuditChainVerifyJob } = await import('../../worker/src/jobs/audit-chain-verify.job.js');

    const dispatchJob = new AuditOutboxDispatchJob(environment.prisma);
    const chainVerifyJob = new AuditChainVerifyJob(environment.prisma);
    const workerResult = {
      dispatch: await dispatchJob.processPendingBatch(),
      chainVerify: await chainVerifyJob.run(),
    };

    if (workerResult.dispatch.processed < 1) {
      fail('worker-dispatch', `processed=${String(workerResult.dispatch.processed)}`);
    }
    pass('worker-dispatch', `processed=${String(workerResult.dispatch.processed)}`);

    if (!workerResult.chainVerify.valid) {
      fail('chain-verify', JSON.stringify(workerResult.chainVerify));
    }
    pass('chain-verify', `valid=true, eventCount=${String(workerResult.chainVerify.eventCount)}`);

    const event = await environment.prisma.auditEvent.findFirst({
      where: { correlationId },
    });

    if (!event?.eventHash || !/^[a-f0-9]{64}$/.test(event.eventHash)) {
      fail('chain-hash', `event_hash geçersiz: ${event?.eventHash ?? 'null'}`);
    }
    pass('chain-hash', `event_hash=${event.eventHash.slice(0, 16)}...`);

    const sealService = new AuditSealService();
    const verification = await sealService.verifyChainIntegrity(
      sealService.createPrismaChainQuery(environment.prisma),
    );
    if (!verification.valid) {
      fail('chain-integrity', JSON.stringify(verification));
    }
    pass('chain-integrity', `eventCount=${String(verification.eventCount)}`);

    await checkAppendOnly(pool);
    checkRedaction();
  } finally {
    await pool.end();
    await environment.teardown();
  }
}

async function runLiveSmoke(): Promise<void> {
  console.log(`\n=== Faz 3 Smoke Test (canlı API: ${API_BASE}) ===\n`);

  if (!SESSION_SECRET || !DATABASE_URL) {
    fail('env', 'SESSION_SECRET ve DATABASE_URL gerekli');
  }

  const healthRes = await fetch(`${API_BASE}/health`);
  if (!healthRes.ok) {
    console.warn(`Canlı API health HTTP ${String(healthRes.status)} — --local moda geçiliyor`);
    await runLocalSmoke();
    return;
  }

  const healthBody = (await healthRes.json()) as { status?: string };
  pass('health', `status=${healthBody.status ?? 'ok'}`);

  const cookies = parseSetCookie(healthRes.headers);
  const csrfToken = cookies.get('csrf-token');
  if (!csrfToken) {
    fail('csrf-cookie', 'csrf-token alınamadı');
  }
  pass('csrf-cookie', 'csrf-token set edildi');

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query('SELECT 1');
  } catch (error: unknown) {
    await pool.end();
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`DB erişilemiyor (${message}) — --local moda geçiliyor`);
    await runLocalSmoke();
    return;
  }

  const userResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    ['superadmin@ethics.local'],
  );

  if (userResult.rows.length === 0) {
    await pool.end();
    fail('seed-user', 'superadmin@ethics.local yok — pnpm prisma:seed çalıştırın');
  }

  const userId = userResult.rows[0]?.id;
  if (!userId) {
    await pool.end();
    fail('seed-user', 'superadmin id boş');
  }

  const sid = randomBytes(24).toString('hex');
  const expire = new Date(Date.now() + 8 * 3_600_000);
  const sess = {
    cookie: {
      originalMaxAge: 8 * 3_600_000,
      expires: expire.toISOString(),
      httpOnly: true,
      path: '/',
    },
    passport: { user: { userId } },
  };

  await pool.query(
    `INSERT INTO user_sessions (sid, sess, expire) VALUES ($1, $2::json, $3)
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, JSON.stringify(sess), expire],
  );

  cookies.set('sid', signSessionId(sid, SESSION_SECRET));
  pass('session', `superadmin oturumu (${userId})`);

  const correlationId = crypto.randomUUID();
  const encryptRes = await fetch(`${API_BASE}/dev/crypto-audit/encrypt-demo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookies),
      'x-csrf-token': csrfToken,
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify({
      plaintext: 'smoke-live-gizli-alice@example.com',
      caseId: 'case-smoke-live',
    }),
  });

  const encryptBody = (await encryptRes.json()) as {
    data?: { auditHandled?: boolean; ciphertextLength?: number };
    error?: { code?: string };
  };

  if (!encryptRes.ok || !encryptBody.data?.auditHandled) {
    await pool.end();
    fail('encrypt-demo', `HTTP ${String(encryptRes.status)} ${encryptBody.error?.code ?? ''}`);
  }

  pass('encrypt-demo', `ciphertextLength=${String(encryptBody.data.ciphertextLength)}`);

  await new Promise((resolve) => setTimeout(resolve, 4_000));

  const outboxResult = await pool.query<{
    dispatch_status: string;
    metadata_json: unknown;
  }>(`SELECT dispatch_status, metadata_json FROM audit_outbox WHERE correlation_id = $1`, [
    correlationId,
  ]);

  const outbox = outboxResult.rows[0];
  if (!outbox) {
    await pool.end();
    fail('audit-outbox', 'kayıt yok');
  }

  const metadataStr = JSON.stringify(outbox.metadata_json ?? {});
  if (metadataStr.includes('smoke-live-gizli') || metadataStr.includes('alice@example.com')) {
    await pool.end();
    fail('audit-outbox', 'metadata PII sızıntısı');
  }

  pass('audit-outbox', `status=${outbox.dispatch_status}`);

  await checkAppendOnly(pool);
  checkRedaction();

  await pool.end();
}

async function main(): Promise<void> {
  if (LOCAL_MODE) {
    await runLocalSmoke();
  } else {
    await runLiveSmoke();
  }

  console.log(
    `\n=== Smoke test tamamlandı: ${String(results.length)}/${String(results.length)} geçti ===\n`,
  );
}

void main().catch((error: unknown) => {
  console.error('Smoke test beklenmeyen hata:', error);
  process.exit(1);
});
