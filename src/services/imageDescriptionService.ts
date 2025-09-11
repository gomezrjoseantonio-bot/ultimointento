// Image Description Service for AI-powered image analysis
// Provides natural language descriptions of uploaded images

export interface ImageDescriptionRequest {
  file: File;
  options?: {
    maxLength?: number;
    language?: 'es' | 'en';
    style?: 'detailed' | 'brief' | 'technical';
  };
}

export interface ImageDescriptionResponse {
  success: boolean;
  description?: string;
  confidence?: number;
  error?: string;
  metadata?: {
    fileSize: number;
    mimeType: string;
    dimensions?: {
      width: number;
      height: number;
    };
    processingTime?: number;
  };
}

export class ImageDescriptionService {
  private static instance: ImageDescriptionService;
  
  static getInstance(): ImageDescriptionService {
    if (!ImageDescriptionService.instance) {
      ImageDescriptionService.instance = new ImageDescriptionService();
    }
    return ImageDescriptionService.instance;
  }

  /**
   * Describe an image using AI vision capabilities
   * @param request - Image description request with file and options
   * @returns Promise with description result
   */
  async describeImage(request: ImageDescriptionRequest): Promise<ImageDescriptionResponse> {
    const startTime = Date.now();
    
    try {
      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp'
      ];

      if (!allowedTypes.includes(request.file.type)) {
        return {
          success: false,
          error: 'Tipo de archivo no soportado. Use JPEG, PNG, GIF, WebP o BMP.'
        };
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (request.file.size > maxSize) {
        return {
          success: false,
          error: 'El archivo es demasiado grande. Máximo 10MB permitido.'
        };
      }

      // Get image dimensions
      const dimensions = await this.getImageDimensions(request.file);

      // Convert file to base64
      const base64Data = await this.fileToBase64(request.file);

      // Call the image description API (mock implementation for now)
      const description = await this.callImageDescriptionAPI(base64Data, request.options);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        description,
        confidence: 0.95, // Mock confidence score
        metadata: {
          fileSize: request.file.size,
          mimeType: request.file.type,
          dimensions,
          processingTime
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Error procesando imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        metadata: {
          fileSize: request.file.size,
          mimeType: request.file.type,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get image dimensions from file
   */
  private async getImageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        const dimensions = {
          width: img.naturalWidth,
          height: img.naturalHeight
        };
        URL.revokeObjectURL(url);
        resolve(dimensions);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      
      img.src = url;
    });
  }

  /**
   * Convert file to base64 string
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      
      reader.onerror = () => {
        reject(new Error('Error leyendo archivo'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Call the image description API (mock implementation)
   * In a real implementation, this would call OpenAI Vision API, Google Vision API, etc.
   */
  private async callImageDescriptionAPI(
    base64Data: string,
    options?: ImageDescriptionRequest['options']
  ): Promise<string> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // For now, return a mock description based on options
    const language = options?.language || 'es';
    const style = options?.style || 'detailed';

    const mockDescriptions = {
      es: {
        detailed: 'Esta es una imagen que muestra varios elementos visuales. Se pueden observar formas, colores y texturas que forman una composición visual. La imagen contiene información visual que puede ser de carácter documental, artístico o informativo.',
        brief: 'Imagen con elementos visuales diversos.',
        technical: 'Archivo de imagen digital con contenido visual estructurado.'
      },
      en: {
        detailed: 'This is an image showing various visual elements. Different shapes, colors, and textures can be observed forming a visual composition. The image contains visual information that may be documentary, artistic, or informational in nature.',
        brief: 'Image with diverse visual elements.',
        technical: 'Digital image file with structured visual content.'
      }
    };

    return mockDescriptions[language][style];
  }

  /**
   * Utility method to validate if file is an image
   */
  static isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Utility method to get supported file types
   */
  static getSupportedTypes(): string[] {
    return [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp'
    ];
  }
}

// Export singleton instance
export const imageDescriptionService = ImageDescriptionService.getInstance();