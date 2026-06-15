import { CSRF_HEADER_NAME, getCsrfToken } from '@/api/csrf';
import { env } from '@/config/env';

export function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  mimeType: string,
): Promise<void> {
  return uploadToPresignedUrlWithProgress(uploadUrl, file, mimeType);
}

export function resolvePresignedUploadUrl(uploadUrl: string): string {
  if (!uploadUrl.startsWith('local-storage://put/')) {
    return uploadUrl;
  }

  const withoutScheme = uploadUrl.slice('local-storage://put/'.length);
  const questionIndex = withoutScheme.indexOf('?');
  const encodedStorageKey =
    questionIndex >= 0 ? withoutScheme.slice(0, questionIndex) : withoutScheme;
  const query = questionIndex >= 0 ? withoutScheme.slice(questionIndex + 1) : '';
  const params = new URLSearchParams(query);

  params.set('storageKey', decodeURIComponent(encodedStorageKey));

  return `${env.apiBaseUrl}/dev/local-storage/put?${params.toString()}`;
}

function requiresCsrfToken(uploadUrl: string): boolean {
  return uploadUrl.startsWith('/') || uploadUrl.startsWith(env.apiBaseUrl);
}

export function uploadToPresignedUrlWithProgress(
  uploadUrl: string,
  file: File,
  mimeType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const resolvedUploadUrl = resolvePresignedUploadUrl(uploadUrl);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error('Dosya yüklemesi başarısız oldu.'));
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Dosya yüklemesi başarısız oldu.'));
    });

    xhr.open('PUT', resolvedUploadUrl);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', mimeType);

    if (requiresCsrfToken(resolvedUploadUrl)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        xhr.setRequestHeader(CSRF_HEADER_NAME, csrfToken);
      }
    }

    xhr.send(file);
  });
}
