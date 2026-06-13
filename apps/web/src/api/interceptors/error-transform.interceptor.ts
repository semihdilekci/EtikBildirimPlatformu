import type { AxiosError, AxiosInstance } from 'axios';

import { ApiError, type ApiErrorEnvelope } from '@/types/api.types';

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const error = (value as ApiErrorEnvelope).error;
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.requestId === 'string'
  );
}

export function attachErrorTransformInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response && isApiErrorEnvelope(error.response.data)) {
        const envelope = error.response.data;
        return Promise.reject(
          new ApiError({
            code: envelope.error.code,
            message: envelope.error.message,
            requestId: envelope.error.requestId,
            status: error.response.status,
            details: envelope.error.details,
          }),
        );
      }

      return Promise.reject(error);
    },
  );
}
