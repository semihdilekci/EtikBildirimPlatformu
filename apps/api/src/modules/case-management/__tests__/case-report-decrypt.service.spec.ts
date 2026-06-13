import { describe, expect, it } from 'vitest';

import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CaseReportDecryptService } from '../case-report-decrypt.service.js';

function buildTestCryptoService(): CryptoService {
  const envService = {
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: Buffer.alloc(32, 0x01).toString('base64'),
    cryptoLocalKekDocument: Buffer.alloc(32, 0x02).toString('base64'),
  } as EnvService;

  return new CryptoService(new LocalKeyManagementAdapter(envService));
}

describe('CaseReportDecryptService', () => {
  const service = new CaseReportDecryptService(buildTestCryptoService());

  it('plaintext metadata ile alanları doğrudan döner', async () => {
    const result = await service.decryptReportFields({
      id: 'report-decrypt-1',
      incidentDescription: 'Plaintext olay açıklaması.',
      reporterIdentityName: null,
      reporterIdentityTitle: null,
      reporterIdentityRelation: null,
      reporterContactEmail: null,
      reporterContactPhone: null,
      urgentRiskDescription: null,
      involvedPersons: JSON.stringify([{ name: 'Kişi A' }]),
      witnesses: null,
      categorySpecificData: null,
      encryptionMetadata: { algorithm: 'none' },
    });

    expect(result.incidentDescription).toBe('Plaintext olay açıklaması.');
    expect(result.involvedPersons).toEqual([{ name: 'Kişi A' }]);
    expect(result.witnesses).toBeNull();
  });

  it('JSON parse edilemeyen involved_persons ham string döner', async () => {
    const result = await service.decryptReportFields({
      id: 'report-decrypt-2',
      incidentDescription: 'Açıklama.',
      reporterIdentityName: null,
      reporterIdentityTitle: null,
      reporterIdentityRelation: null,
      reporterContactEmail: null,
      reporterContactPhone: null,
      urgentRiskDescription: null,
      involvedPersons: 'not-json',
      witnesses: null,
      categorySpecificData: null,
      encryptionMetadata: { algorithm: 'none' },
    });

    expect(result.involvedPersons).toBe('not-json');
  });
});
