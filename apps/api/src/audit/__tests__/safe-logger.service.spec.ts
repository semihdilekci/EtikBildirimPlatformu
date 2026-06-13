import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvService } from '../../common/config/env.service.js';
import { MASKED_EMAIL, MASKED_PHONE, MASKED_SECRET } from '../redaction.constants.js';
import { RedactionService } from '../redaction.service.js';
import { SafeLoggerService } from '../safe-logger.service.js';

function buildEnvService(): EnvService {
  return {
    isProduction: false,
    logRedactionEnabled: true,
  } as EnvService;
}

describe('SafeLoggerService', () => {
  let pino: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    fatal: ReturnType<typeof vi.fn>;
  };
  let safeLogger: SafeLoggerService;

  beforeEach(() => {
    pino = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    };

    const redactionService = new RedactionService(buildEnvService());
    safeLogger = new SafeLoggerService(pino as never, redactionService);
  });

  it('info çağrısında PII redaction uygular', () => {
    safeLogger.info(
      {
        userEmail: 'alice@example.com',
        password: 'plain-text',
        caseId: 'case-1',
      },
      'User action',
    );

    expect(pino.info).toHaveBeenCalledWith(
      {
        userEmail: MASKED_EMAIL,
        password: MASKED_SECRET,
        caseId: 'case-1',
      },
      'User action',
    );
  });

  it('error çağrısında hassas bağlamı maskeler', () => {
    safeLogger.error({ token: 'jwt-secret', correlationId: 'corr-1' }, 'Failure');

    expect(pino.error).toHaveBeenCalledWith(
      {
        token: MASKED_SECRET,
        correlationId: 'corr-1',
      },
      'Failure',
    );
  });

  it('warn ve debug çağrılarında redaction uygular', () => {
    safeLogger.warn({ phone: '+905551112233' }, 'Warn');
    safeLogger.debug({ secret: 'value' }, 'Debug');

    expect(pino.warn).toHaveBeenCalledWith({ phone: MASKED_PHONE }, 'Warn');
    expect(pino.debug).toHaveBeenCalledWith({ secret: MASKED_SECRET }, 'Debug');
  });

  it('fatal çağrısında redaction uygular', () => {
    safeLogger.fatal({ apiSecret: 'fatal-secret' }, 'Fatal');

    expect(pino.fatal).toHaveBeenCalledWith({ apiSecret: MASKED_SECRET }, 'Fatal');
  });

  it('dizi context value anahtarıyla sarar', () => {
    const redactionWithArray = new RedactionService({
      isProduction: true,
      logRedactionEnabled: true,
    } as EnvService);
    const logger = new SafeLoggerService(pino as never, redactionWithArray);

    logger.info(['visible'] as never, 'Array context');

    expect(pino.info).toHaveBeenCalledWith({ value: ['visible'] }, 'Array context');
  });
});
