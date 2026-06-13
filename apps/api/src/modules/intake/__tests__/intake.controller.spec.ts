import { describe, expect, it, vi } from 'vitest';

import { IntakeController } from '../intake.controller.js';
import { IntakeService } from '../intake.service.js';
import { ReportAttachmentService } from '../report-attachment.service.js';

describe('IntakeController (unit)', () => {
  const intakeService = {
    listCategories: vi.fn(() => [{ code: 'EMBEZZLEMENT' }]),
    getKvkkText: vi.fn(() => Promise.resolve({ version: '1.0', bodyHtml: '<p>kvkk</p>' })),
    listActiveCompanies: vi.fn(() => Promise.resolve([{ id: 'c1', name: 'Test' }])),
    createReport: vi.fn(() =>
      Promise.resolve({
        trackingCode: 'ETK-TEST-CODE',
        submittedAt: '2026-06-01T00:00:00.000Z',
        message: 'ok',
      }),
    ),
  } as unknown as IntakeService;

  const reportAttachmentService = {
    initiateUpload: vi.fn(() =>
      Promise.resolve({
        id: 'att-1',
        originalFilename: 'ek.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        malwareScanStatus: 'PENDING' as const,
        uploadUrl: 'https://storage/upload',
        uploadUrlExpiresAt: '2026-06-01T01:00:00.000Z',
        uploadedAt: '2026-06-01T00:00:00.000Z',
      }),
    ),
  } as unknown as ReportAttachmentService;

  const controller = new IntakeController(intakeService, reportAttachmentService);

  it('listCategories servis sonucunu data zarfında döner', () => {
    const result = controller.listCategories();
    expect(result.data).toEqual([{ code: 'EMBEZZLEMENT' }]);
  });

  it('getKvkkText aktif metni döner', async () => {
    const result = await controller.getKvkkText();
    expect(result.data.version).toBe('1.0');
  });

  it('listCompanies aktif şirketleri döner', async () => {
    const result = await controller.listCompanies();
    expect(result.data).toHaveLength(1);
  });

  it('createReport correlationId ile servisi çağırır', async () => {
    const body = { trackingPassword: 'Pass123!' } as never;
    const request = { correlationId: 'corr-123' } as never;

    const result = await controller.createReport(body, request);

    expect(intakeService.createReport).toHaveBeenCalledWith(body, 'corr-123');
    expect(result.data.trackingCode).toBe('ETK-TEST-CODE');
  });

  it('initiateAttachment presigned upload sonucunu döner', async () => {
    const body = {
      originalFilename: 'kanit.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      contentSha256: 'abc',
    };
    const request = { correlationId: 'corr-456' } as never;

    const result = await controller.initiateAttachment('ETK-ABCD-EFGH', body, request);

    expect(reportAttachmentService.initiateUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingCode: 'ETK-ABCD-EFGH',
        body,
        correlationId: 'corr-456',
      }),
    );
    expect(result.data.id).toBe('att-1');
  });
});
