/**
 * Logo Upload Service
 * 
 * Handles logo uploads for accounts with validation and storage
 */

/**
 * Validates image file for logo upload
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato permitido JPG/PNG. Máx. 512 KB.'
    };
  }

  // Check file size (512KB = 512 * 1024 bytes)
  const maxSize = 512 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Formato permitido JPG/PNG. Máx. 512 KB.'
    };
  }

  return { valid: true };
}

/**
 * Processes and uploads logo file
 * Returns a blob URL for preview and storage path
 */
export async function processLogoUpload(file: File, accountId: number): Promise<{
  previewUrl: string;
  logoUrl: string;
}> {
  const validation = validateLogoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create preview URL for immediate display
  const previewUrl = URL.createObjectURL(file);

  // For now, we'll use the preview URL as storage
  // In a real implementation, this would upload to a proper storage service
  const logoUrl = `uploads/cuentas/${accountId}/logo.${file.name.split('.').pop()}`;

  // Store the file blob in localStorage for client-side persistence
  // In production, this would be uploaded to cloud storage
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      try {
        localStorage.setItem(`logo_${accountId}`, reader.result as string);
        resolve({ previewUrl, logoUrl });
      } catch (error) {
        reject(new Error('Error almacenando logo'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Retrieves logo from storage
 */
export function getLogoFromStorage(accountId: number): string | null {
  return localStorage.getItem(`logo_${accountId}`);
}

/**
 * Removes logo from storage
 */
export function removeLogoFromStorage(accountId: number): void {
  localStorage.removeItem(`logo_${accountId}`);
}

/**
 * Resizes image to recommended dimensions (800x600) while maintaining aspect ratio
 */
export function resizeImage(file: File, maxWidth: number = 800, maxHeight: number = 600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // Set canvas size
      canvas.width = maxWidth;
      canvas.height = maxHeight;

      // Fill with white background for JPEG compatibility
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, maxWidth, maxHeight);

        // Center the image
        const x = (maxWidth - width) / 2;
        const y = (maxHeight - height) / 2;
        
        ctx.drawImage(img, x, y, width, height);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Error procesando imagen'));
          }
        },
        file.type,
        0.9
      );
    };

    img.onerror = () => reject(new Error('Error cargando imagen'));
    img.src = URL.createObjectURL(file);
  });
}