const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_SIDE = 1200;

/**
 * Normalizes an image file for storage:
 * - JPEG/PNG: returned as-is if within MAX_SIDE; downscaled otherwise.
 * - Any other format (WEBP, HEIC, etc.): converted to JPEG at quality 0.88.
 * Uses HTMLCanvasElement — browser context only.
 */
export async function normalizePhoto(file: File): Promise<File> {
  const needsConversion = !SUPPORTED_TYPES.has(file.type);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      // No conversion needed and image is within size limits
      if (!needsConversion && scale === 1) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const mimeType = needsConversion ? 'image/jpeg' : file.type;
      const quality = mimeType === 'image/jpeg' ? 0.88 : undefined;
      const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const baseName = file.name.replace(/\.[^.]+$/, '');

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          resolve(new File([blob], `${baseName}.${ext}`, { type: mimeType }));
        },
        mimeType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}
