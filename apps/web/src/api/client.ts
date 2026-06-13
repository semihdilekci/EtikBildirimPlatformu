import axios from 'axios';

import { env } from '@/config/env';
import { attachCsrfInterceptor } from '@/api/interceptors/csrf.interceptor';
import { attachErrorTransformInterceptor } from '@/api/interceptors/error-transform.interceptor';
import { attachSessionExpiredInterceptor } from '@/api/interceptors/session-expired.interceptor';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

attachCsrfInterceptor(apiClient);
attachErrorTransformInterceptor(apiClient);
attachSessionExpiredInterceptor(apiClient);
