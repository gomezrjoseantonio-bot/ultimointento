/**
 * T29 · Comprime una imagen a base64 con tamaño objetivo.
 *
 * - Resize · max width `maxWidthPx` (mantiene aspecto)
 * - Quality jpeg · iterativa hasta tamaño objetivo
 * - Devuelve data URL base64 (`image/jpeg`)
 *
 * Throw si la imagen final supera `maxSizeKB` incluso con quality 0.1.
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = 500,
  maxWidthPx: number = 1600,
): Promise<string> {
  if (!/^image\//.test(file.type)) {
    throw new Error('El archivo no es una imagen');
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, maxWidthPx / img.width);
  const targetWidth = Math.round(img.width * ratio);
  const targetHeight = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo crear el contexto del canvas');
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const maxSizeBytes = maxSizeKB * 1024;
  for (let q = 0.9; q >= 0.1 - 1e-6; q -= 0.1) {
    const quality = Math.max(0.1, Math.round(q * 10) / 10);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (estimateBase64Bytes(url) <= maxSizeBytes) {
      return url;
    }
  }

  throw new Error(`Imagen demasiado grande · supera ${maxSizeKB}KB tras compresión máxima`);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Error leyendo el archivo'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Error leyendo el archivo'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagen no válida o corrupta'));
    img.src = src;
  });
}

function estimateBase64Bytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
