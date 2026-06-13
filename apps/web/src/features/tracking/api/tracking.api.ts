import type {
  TrackingVerifyResponse,
  TrackingStatusResponse,
  SecureMessageItem,
  SendSecureMessageResponse,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { TrackingCredentials } from '@/features/tracking/context/TrackingContext';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export const TRACKING_CODE_HEADER = 'X-Tracking-Code';
export const TRACKING_PASSWORD_HEADER = 'X-Tracking-Password';

export function buildTrackingHeaders(credentials: TrackingCredentials): Record<string, string> {
  return {
    [TRACKING_CODE_HEADER]: credentials.trackingCode.toUpperCase(),
    [TRACKING_PASSWORD_HEADER]: credentials.trackingPassword,
  };
}

export async function verifyTracking(
  credentials: TrackingCredentials,
): Promise<TrackingVerifyResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<TrackingVerifyResponse>>(
    '/tracking/verify',
    {},
    {
      headers: buildTrackingHeaders(credentials),
    },
  );

  return response.data.data;
}

export async function fetchTrackingStatus(
  credentials: TrackingCredentials,
): Promise<TrackingStatusResponse> {
  const response = await apiClient.get<ApiSuccessEnvelope<TrackingStatusResponse>>(
    '/tracking/status',
    {
      headers: buildTrackingHeaders(credentials),
    },
  );

  return response.data.data;
}

export async function fetchTrackingMessages(
  credentials: TrackingCredentials,
): Promise<SecureMessageItem[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<SecureMessageItem[]>>(
    '/tracking/messages',
    {
      headers: buildTrackingHeaders(credentials),
    },
  );

  return response.data.data;
}

export async function sendTrackingMessage(
  credentials: TrackingCredentials,
  bodyText: string,
): Promise<SendSecureMessageResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<SendSecureMessageResponse>>(
    '/tracking/messages',
    { bodyText },
    {
      headers: buildTrackingHeaders(credentials),
    },
  );

  return response.data.data;
}
