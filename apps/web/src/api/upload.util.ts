export function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  mimeType: string,
): Promise<void> {
  return uploadToPresignedUrlWithProgress(uploadUrl, file, mimeType);
}

export function uploadToPresignedUrlWithProgress(
  uploadUrl: string,
  file: File,
  mimeType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
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

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.send(file);
  });
}
