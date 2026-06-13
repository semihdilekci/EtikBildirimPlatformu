import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { CSRF_HEADER_NAME, getCsrfToken, isMutatingMethod } from '@/api/csrf';

export function attachCsrfInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const method = config.method ?? 'GET';

    if (!isMutatingMethod(method)) {
      return config;
    }

    const token = getCsrfToken();
    if (token) {
      config.headers.set(CSRF_HEADER_NAME, token);
    }

    return config;
  });
}
