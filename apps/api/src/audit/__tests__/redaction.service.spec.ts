import { beforeEach, describe, expect, it } from 'vitest';

import { EnvService } from '../../common/config/env.service.js';
import { CRYPTO_ALGORITHM } from '../../crypto/crypto.constants.js';
import {
  MASKED_EMAIL,
  MASKED_PHONE,
  MASKED_SECRET,
  REDACTED_PLACEHOLDER,
} from '../redaction.constants.js';
import { RedactionService } from '../redaction.service.js';

function buildEnvService(overrides: Partial<EnvService> = {}): EnvService {
  return {
    isProduction: false,
    logRedactionEnabled: true,
    ...overrides,
  } as EnvService;
}

describe('RedactionService', () => {
  let service: RedactionService;

  beforeEach(() => {
    service = new RedactionService(buildEnvService());
  });

  it('email alanını ***@***.com olarak maskeler', () => {
    const result = service.redactForLog({ userEmail: 'alice@example.com' });
    expect(result).toEqual({ userEmail: MASKED_EMAIL });
  });

  it('phone alanını *** olarak maskeler', () => {
    const result = service.redactForLog({ contactPhone: '+905551234567' });
    expect(result).toEqual({ contactPhone: MASKED_PHONE });
  });

  it('password/token/secret alanlarını maskeler', () => {
    const result = service.redactForLog({
      password: 'plain-secret',
      access_token: 'jwt-value',
      apiSecret: 'shhh',
    });

    expect(result).toEqual({
      password: MASKED_SECRET,
      access_token: MASKED_SECRET,
      apiSecret: MASKED_SECRET,
    });
  });

  it('string içindeki inline email maskeler', () => {
    const input = 'İletişim: alice@example.com';
    expect(service.redactString(input)).toBe(`İletişim: ${MASKED_EMAIL}`);
  });

  it('EncryptedFieldResult yapısını [REDACTED] olarak maskeler', () => {
    const result = service.redactForLog({
      report_text: {
        ciphertext: 'abc',
        encryptedDek: 'dek',
        kmsKeyId: 'local-field',
        algorithm: CRYPTO_ALGORITHM,
      },
    });

    expect(result).toEqual({ report_text: REDACTED_PLACEHOLDER });
  });

  it('audit snapshot modunda şifreli içerik alanlarını [REDACTED] yapar', () => {
    const snapshot = {
      caseId: 'case-1',
      report_text: 'Gizli bildirim metni',
      incident_description: 'Detaylı açıklama',
      actorId: 'user-1',
    };

    expect(service.redactAuditSnapshot(snapshot)).toEqual({
      caseId: 'case-1',
      report_text: REDACTED_PLACEHOLDER,
      incident_description: REDACTED_PLACEHOLDER,
      actorId: 'user-1',
    });
  });

  it('iç içe nesnelerde recursive redaction uygular', () => {
    const result = service.redactForLog({
      context: {
        nested: {
          email: 'bob@test.com',
          safeField: 'visible',
        },
      },
    });

    expect(result).toEqual({
      context: {
        nested: {
          email: MASKED_EMAIL,
          safeField: 'visible',
        },
      },
    });
  });

  it('LOG_REDACTION_ENABLED=false iken non-prod ortamda redaction atlanır', () => {
    const disabled = new RedactionService(
      buildEnvService({ logRedactionEnabled: false, isProduction: false }),
    );

    expect(disabled.redactForLog({ password: 'secret' })).toEqual({ password: 'secret' });
  });

  it('production ortamda LOG_REDACTION_ENABLED=false olsa bile redaction uygular', () => {
    const production = new RedactionService(
      buildEnvService({ logRedactionEnabled: false, isProduction: true }),
    );

    expect(production.redactForLog({ password: 'secret' })).toEqual({ password: MASKED_SECRET });
  });

  it('audit snapshot bypass denemesi: içerik alanları [REDACTED] kalır', () => {
    const snapshot = {
      caseId: 'case-1',
      report_text: 'Sızıntı denemesi — gizli metin',
      incident_description: 'Açıklama',
      nested: {
        reporter_email: 'leak@example.com',
      },
    };

    const redacted = service.redactAuditSnapshot(snapshot);

    expect(redacted).toEqual({
      caseId: 'case-1',
      report_text: REDACTED_PLACEHOLDER,
      incident_description: REDACTED_PLACEHOLDER,
      nested: {
        reporter_email: MASKED_EMAIL,
      },
    });
    expect(JSON.stringify(redacted)).not.toContain('Sızıntı denemesi');
  });

  it('null ve undefined değerleri olduğu gibi döndürür', () => {
    expect(service.redactForLog(null)).toBeNull();
    expect(service.redactForLog(undefined)).toBeUndefined();
  });

  it('audit snapshot redaction devre dışıyken bypass edilmez — production zorunlu', () => {
    const disabled = new RedactionService(
      buildEnvService({ logRedactionEnabled: false, isProduction: false }),
    );

    expect(disabled.redactAuditSnapshot({ report_text: 'gizli' })).toEqual({
      report_text: 'gizli',
    });
  });

  it('redactString devre dışıyken metni değiştirmez', () => {
    const disabled = new RedactionService(
      buildEnvService({ logRedactionEnabled: false, isProduction: false }),
    );

    expect(disabled.redactString('alice@example.com')).toBe('alice@example.com');
  });

  it('bilinmeyen hassas anahtar REDACTED_PLACEHOLDER ile maskelenir', () => {
    const result = service.redactForLog({ report_text: 'gizli içerik' });
    expect(result).toEqual({ report_text: REDACTED_PLACEHOLDER });
  });
});

describe('redaction.constants', () => {
  it('isSensitiveFieldKey hassas anahtarları tanır', async () => {
    const { isSensitiveFieldKey } = await import('../redaction.constants.js');

    expect(isSensitiveFieldKey('password')).toBe(true);
    expect(isSensitiveFieldKey('access_token')).toBe(true);
    expect(isSensitiveFieldKey('userEmail')).toBe(true);
    expect(isSensitiveFieldKey('caseId')).toBe(false);
  });

  it('buildPinoRedactPaths authorization ve wildcard path içerir', async () => {
    const { buildPinoRedactPaths } = await import('../redaction.constants.js');
    const paths = buildPinoRedactPaths();

    expect(paths).toContain('req.headers.authorization');
    expect(paths).toContain('*.password');
    expect(paths).toContain('*.report_text');
  });
});
