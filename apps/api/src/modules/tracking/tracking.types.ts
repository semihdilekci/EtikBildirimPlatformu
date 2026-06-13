import type { ReportStatusCode } from '@ethics/shared';

export type TrackingReportContext = {
  reportId: string;
  trackingCode: string;
  status: ReportStatusCode;
  submittedAt: Date;
  lastActivityAt: Date | null;
  companyId: string;
};

export type TrackingVerifyResult = {
  verified: true;
  reportStatus: ReportStatusCode;
  hasUnreadMessages: boolean;
  submittedAt: string;
};

export type TrackingStatusResult = {
  trackingCode: string;
  status: ReportStatusCode;
  statusLabel: string;
  submittedAt: string;
  lastActivityAt: string | null;
};
