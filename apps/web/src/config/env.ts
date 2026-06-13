const DEFAULT_API_BASE_URL = '/api/v1';

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  return DEFAULT_API_BASE_URL;
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  appEnv: import.meta.env.VITE_APP_ENV,
  isProduction: import.meta.env.VITE_APP_ENV === 'production',
} as const;
