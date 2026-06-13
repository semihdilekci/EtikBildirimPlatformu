import { ErrorCode } from '@ethics/shared';
import { describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { ReportAttachmentService } from '../../intake/report-attachment.service.js';
import { SecureMessageService } from '../secure-message.service.js';
import { TrackingController } from '../tracking.controller.js';
import { TrackingService } from '../tracking.service.js';

describe('TrackingController (unit)', () => {
  const trackingService = {
    verify: vi.fn(() =>
      Promise.resolve({
        verified: true,
        reportStatus: 'SUBMITTED',
        hasUnreadMessages: false,
        submittedAt: '2026-06-01T00:00:00.000Z',
      }),
    ),
    getStatus: vi.fn(() => ({
      trackingCode: 'ETK-ABCD-EFGH',
      status: 'SUBMITTED',
      statusLabel: 'Alındı',
      submittedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: null,
    })),
  } as unknown as TrackingService;

  const secureMessageService = {
    listMessages: vi.fn(() => Promise.resolve([{ id: 'msg-1', bodyText: 'Merhaba' }])),
    sendMessage: vi.fn(() => Promise.resolve({ id: 'msg-2', sentAt: '2026-06-01T00:00:00.000Z' })),
  } as unknown as SecureMessageService;

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

  const controller = new TrackingController(
    trackingService,
    secureMessageService,
    reportAttachmentService,
  );

  const reportContext = {
    reportId: 'report-1',
    trackingCode: 'ETK-ABCD-EFGH',
    status: 'SUBMITTED',
    submittedAt: new Date(),
    lastActivityAt: null,
    companyId: 'company-1',
  };

  it('verify servis sonucunu data zarfında döner', async () => {
    const request = { correlationId: 'corr-1', headers: {} } as never;
    const result = await controller.verify(request);

    expect(trackingService.verify).toHaveBeenCalledWith(request, 'corr-1');
    expect(result.data.verified).toBe(true);
  });

  it('getStatus minimal durum döner', () => {
    const request = { trackingReport: reportContext } as never;
    const result = controller.getStatus(request);

    expect(result.data.statusLabel).toBe('Alındı');
  });

  it('listMessages thread listesini döner', async () => {
    const request = { trackingReport: reportContext, correlationId: 'corr-2' } as never;
    const result = await controller.listMessages(request);

    expect(secureMessageService.listMessages).toHaveBeenCalledWith(reportContext, 'corr-2');
    expect(result.data).toHaveLength(1);
  });

  it('listMessages trackingReport yoksa INTERNAL_ERROR', async () => {
    const request = { correlationId: 'corr-3' } as never;

    await expect(controller.listMessages(request)).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
    });
  });

  it('sendMessage yeni mesaj oluşturur', async () => {
    const request = { trackingReport: reportContext, correlationId: 'corr-4' } as never;
    const body = { bodyText: 'Yeni mesaj metni yeterli uzunlukta.' };

    const result = await controller.sendMessage(body, request);

    expect(secureMessageService.sendMessage).toHaveBeenCalledWith(reportContext, body, 'corr-4');
    expect(result.data.id).toBe('msg-2');
  });

  it('sendMessage trackingReport yoksa INTERNAL_ERROR', async () => {
    const request = {} as never;
    const body = { bodyText: 'Yeni mesaj metni yeterli uzunlukta.' };

    await expect(controller.sendMessage(body, request)).rejects.toBeInstanceOf(DomainException);
  });

  it('initiateAttachment presigned URL döner', async () => {
    const request = { trackingReport: reportContext, correlationId: 'corr-5' } as never;
    const body = {
      originalFilename: 'ek.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      contentSha256: 'def',
    };

    const result = await controller.initiateAttachment(body, request);

    expect(reportAttachmentService.initiateUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingCode: 'ETK-ABCD-EFGH',
        correlationId: 'corr-5',
      }),
    );
    expect(result.data.id).toBe('att-1');
  });

  it('initiateAttachment trackingCode yoksa INTERNAL_ERROR', async () => {
    const request = { trackingReport: { reportId: 'r1' } } as never;
    const body = {
      originalFilename: 'ek.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      contentSha256: 'def',
    };

    await expect(controller.initiateAttachment(body, request)).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
