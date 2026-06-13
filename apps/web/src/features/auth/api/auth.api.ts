import { authMeResponseSchema, type AuthMeResponse } from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchCurrentUser(): Promise<AuthMeResponse> {
  const response = await apiClient.get<ApiSuccessEnvelope<AuthMeResponse>>('/auth/me');
  return authMeResponseSchema.parse(response.data.data);
}

export function buildOidcLoginUrl(returnUrl?: string): string {
  const params = new URLSearchParams();
  if (returnUrl) {
    params.set('returnUrl', returnUrl);
  }

  const query = params.toString();
  return query.length > 0 ? `/api/v1/auth/oidc/login?${query}` : '/api/v1/auth/oidc/login';
}
