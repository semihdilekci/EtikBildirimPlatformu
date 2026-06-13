import type { AxiosInstance } from 'axios';

import { ApiError } from '@/types/api.types';

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler): void {
  sessionExpiredHandler = handler;
}

export function attachSessionExpiredInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        sessionExpiredHandler?.();
      }

      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    },
  );
}
