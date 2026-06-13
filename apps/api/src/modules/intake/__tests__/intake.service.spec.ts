import {
  ErrorCode,
  REPORT_CATEGORY_CATALOG,
  ReportCategoryGroup,
  ReportSubCategory,
} from '@ethics/shared';
import { describe, expect, it, vi } from 'vitest';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { TrackingPasswordService } from '../tracking-password.service.js';
import { IntakeService } from '../intake.service.js';

function createIntakeService(prisma: Record<string, unknown>) {
  const cryptoService = {
    encryptField: vi.fn((plaintext: string) =>
      Promise.resolve({
        ciphertext: Buffer.from(`enc:${plaintext}`).toString('base64'),
        encryptedDek: 'dek',
        kmsKeyId: 'local',
        algorithm: 'AES-256-GCM',
      }),
    ),
  } as unknown as CryptoService;

  const trackingPasswordService = {
    hashPassword: vi.fn(() => Promise.resolve('$argon2id$v=19$m=65536,t=3,p=1$hash')),
  } as unknown as TrackingPasswordService;

  const auditPublisher = {
    publish: vi.fn(() => Promise.resolve(undefined)),
  } as unknown as AuditEventPublisher;

  return new IntakeService(prisma as never, cryptoService, trackingPasswordService, auditPublisher);
}

describe('IntakeService (unit)', () => {
  it('listCategories katalog döner', () => {
    const service = createIntakeService({});
    expect(service.listCategories()).toEqual(REPORT_CATEGORY_CATALOG);
  });

  it('getKvkkText aktif versiyon döner', async () => {
    const prisma = {
      kvkkConsentVersion: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            versionCode: '1.0',
            contentText: 'Test <b>KVKK</b> metni',
            publishedAt: new Date('2026-01-01T00:00:00.000Z'),
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        ),
      },
    };

    const service = createIntakeService(prisma);
    const result = await service.getKvkkText();

    expect(result.version).toBe('1.0');
    expect(result.bodyHtml).toContain('&lt;b&gt;KVKK&lt;/b&gt;');
    expect(result.privacyNoticeHtml).toContain('gizli');
  });

  it('getKvkkText aktif versiyon yoksa INTERNAL_ERROR', async () => {
    const prisma = {
      kvkkConsentVersion: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    };

    const service = createIntakeService(prisma);

    await expect(service.getKvkkText()).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
    });
  });

  it('listActiveCompanies yalnızca aktif şirketleri döner', async () => {
    const prisma = {
      company: {
        findMany: vi.fn(() => Promise.resolve([{ id: 'c1', name: 'A Şirketi', code: 'A' }])),
      },
    };

    const service = createIntakeService(prisma);
    const companies = await service.listActiveCompanies();

    expect(companies).toHaveLength(1);
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('kategori grup uyumsuzluğu → DOCUMENT_TYPE_NOT_ALLOWED', async () => {
    const prisma = {
      company: {
        findUnique: vi.fn(() => Promise.resolve({ isActive: true })),
      },
      kvkkConsentVersion: {
        findFirst: vi.fn(() => Promise.resolve({ versionCode: '1.0', isActive: true })),
      },
    };

    const service = createIntakeService(prisma);

    await expect(
      service.createReport(
        {
          companyId: 'c1',
          incidentCountry: 'TUR',
          incidentCity: 'Ankara',
          categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
          categories: [ReportSubCategory.EMBEZZLEMENT],
          isUncertainCategory: false,
          incidentDescription: 'Uyumsuz kategori testi olay açıklaması yeterli uzunlukta.',
          incidentIsOngoing: false,
          previouslyReported: false,
          urgentRiskFlag: false,
          involvedPersons: [],
          witnesses: [],
          isAnonymous: true,
          trackingPassword: 'SecurePass1',
          kvkkConsentVersion: '1.0',
        },
        'corr-1',
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.DOCUMENT_TYPE_NOT_ALLOWED,
    });
  });

  it('geçersiz KVKK versiyonu → INTAKE_KVKK_VERSION_MISMATCH', async () => {
    const prisma = {
      company: {
        findUnique: vi.fn(() => Promise.resolve({ isActive: true })),
      },
      kvkkConsentVersion: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    };

    const service = createIntakeService(prisma);

    await expect(
      service.createReport(
        {
          companyId: 'c1',
          incidentCountry: 'TUR',
          incidentCity: 'Ankara',
          categoryGroup: ReportCategoryGroup.ASSET_FINANCIAL,
          categories: [ReportSubCategory.EMBEZZLEMENT],
          isUncertainCategory: false,
          incidentDescription: 'KVKK versiyon testi olay açıklaması yeterli uzunlukta.',
          incidentIsOngoing: false,
          previouslyReported: false,
          urgentRiskFlag: false,
          involvedPersons: [],
          witnesses: [],
          isAnonymous: true,
          trackingPassword: 'SecurePass1',
          kvkkConsentVersion: '99.0',
        },
        'corr-2',
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.INTAKE_KVKK_VERSION_MISMATCH,
    });
  });
});
