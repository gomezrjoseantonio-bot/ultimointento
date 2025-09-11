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

    // For now, return a mock description based on options and basic image analysis
    const language = options?.language || 'es';
    const style = options?.style || 'detailed';

    // Generate more realistic descriptions by analyzing base64 data patterns
    const description = this.generateSmartMockDescription(base64Data, language, style);
    
    return description;
  }

  /**
   * Generate more realistic mock descriptions based on image characteristics
   */
  private generateSmartMockDescription(
    base64Data: string, 
    language: 'es' | 'en', 
    style: 'detailed' | 'brief' | 'technical'
  ): string {
    // Analyze base64 data to infer some basic characteristics
    const dataLength = base64Data.length;
    const complexity = this.estimateImageComplexity(base64Data);
    const hasTextLikePatterns = this.detectTextPatterns(base64Data);
    const hasGraphicalElements = this.detectGraphicalElements(base64Data);
    
    // Generate contextual descriptions based on detected patterns
    if (language === 'es') {
      return this.generateSpanishDescription(style, complexity, hasTextLikePatterns, hasGraphicalElements, dataLength);
    } else {
      return this.generateEnglishDescription(style, complexity, hasTextLikePatterns, hasGraphicalElements, dataLength);
    }
  }

  private estimateImageComplexity(base64Data: string): 'low' | 'medium' | 'high' {
    // Simple heuristic based on data patterns and length
    const uniqueChars = new Set(base64Data.slice(0, 1000)).size;
    const repetitionScore = base64Data.length / uniqueChars;
    
    if (repetitionScore > 50) return 'low';
    if (repetitionScore > 20) return 'medium';
    return 'high';
  }

  private detectTextPatterns(base64Data: string): boolean {
    // Look for patterns that might indicate text or diagrams
    const sample = base64Data.slice(0, 2000);
    const textIndicators = ['AAA', 'BBB', 'CCC', 'DDD']; // Common in text-heavy images
    return textIndicators.some(pattern => sample.includes(pattern));
  }

  private detectGraphicalElements(base64Data: string): boolean {
    // Look for patterns that might indicate graphics, charts, or visual elements
    const sample = base64Data.slice(0, 2000);
    const graphicIndicators = ['iVBOR', 'JFIF', 'GIF8']; // Common image format markers
    return graphicIndicators.some(pattern => sample.includes(pattern));
  }

  private generateSpanishDescription(
    style: string, 
    complexity: string, 
    hasText: boolean, 
    hasGraphics: boolean,
    dataLength: number
  ): string {
    const descriptions = {
      detailed: [
        hasText && hasGraphics ? 
          'La imagen presenta un diagrama o infografía con elementos textuales y gráficos bien estructurados. Se observan líneas de conexión, etiquetas de texto y elementos visuales organizados de manera sistemática, sugiriendo un contenido informativo o educativo.' :
        hasText ? 
          'Se trata de una imagen con contenido predominantemente textual, posiblemente un documento, captura de pantalla o diagrama con anotaciones. El texto aparece organizado y legible.' :
        hasGraphics ?
          'La imagen muestra elementos gráficos y visuales, con formas, colores y composiciones que sugieren un diseño artístico, técnico o decorativo.' :
          'Esta imagen presenta una composición visual con diversos elementos. Se pueden apreciar formas, colores y texturas que conforman el contenido visual.',
        
        complexity === 'high' ?
          'La imagen contiene múltiples elementos complejos con gran cantidad de detalles visuales, sugiriendo un contenido rico en información.' :
        complexity === 'medium' ?
          'Se observa una composición de complejidad moderada con varios elementos visuales balanceados.' :
          'La imagen presenta una estructura visual simple y clara, con elementos bien definidos.',
          
        dataLength > 500000 ?
          'La alta resolución de la imagen permite apreciar detalles finos y una calidad visual superior.' :
          'La imagen presenta una resolución estándar adecuada para visualización general.'
      ].join(' '),
      
      brief: [
        hasText && hasGraphics ? 'Diagrama o infografía con texto y elementos gráficos.' :
        hasText ? 'Imagen con contenido textual.' :
        hasGraphics ? 'Imagen con elementos gráficos y visuales.' :
        'Imagen con contenido visual variado.',
        
        complexity === 'high' ? 'Alto nivel de detalle.' :
        complexity === 'medium' ? 'Complejidad moderada.' :
        'Estructura simple.'
      ].join(' '),
      
      technical: [
        `Archivo de imagen digital`,
        hasText ? 'con elementos textuales detectados,' : '',
        hasGraphics ? 'elementos gráficos identificados,' : '',
        `complejidad ${complexity === 'high' ? 'alta' : complexity === 'medium' ? 'media' : 'baja'},`,
        `tamaño de datos ${dataLength > 500000 ? 'grande' : 'estándar'}.`,
        'Formato compatible con procesamiento de visión artificial.'
      ].filter(Boolean).join(' ')
    };

    return descriptions[style as keyof typeof descriptions] || descriptions.detailed;
  }

  private generateEnglishDescription(
    style: string, 
    complexity: string, 
    hasText: boolean, 
    hasGraphics: boolean,
    dataLength: number
  ): string {
    const descriptions = {
      detailed: [
        hasText && hasGraphics ? 
          'The image presents a diagram or infographic with well-structured textual and graphic elements. Connection lines, text labels, and visual elements are systematically organized, suggesting informative or educational content.' :
        hasText ? 
          'This is an image with predominantly textual content, possibly a document, screenshot, or annotated diagram. The text appears organized and legible.' :
        hasGraphics ?
          'The image shows graphic and visual elements, with shapes, colors, and compositions suggesting artistic, technical, or decorative design.' :
          'This image presents a visual composition with various elements. Shapes, colors, and textures that make up the visual content can be appreciated.',
        
        complexity === 'high' ?
          'The image contains multiple complex elements with a wealth of visual details, suggesting information-rich content.' :
        complexity === 'medium' ?
          'A composition of moderate complexity with several balanced visual elements is observed.' :
          'The image presents a simple and clear visual structure with well-defined elements.',
          
        dataLength > 500000 ?
          'The high resolution of the image allows fine details and superior visual quality to be appreciated.' :
          'The image presents standard resolution suitable for general viewing.'
      ].join(' '),
      
      brief: [
        hasText && hasGraphics ? 'Diagram or infographic with text and graphic elements.' :
        hasText ? 'Image with textual content.' :
        hasGraphics ? 'Image with graphic and visual elements.' :
        'Image with varied visual content.',
        
        complexity === 'high' ? 'High level of detail.' :
        complexity === 'medium' ? 'Moderate complexity.' :
        'Simple structure.'
      ].join(' '),
      
      technical: [
        `Digital image file`,
        hasText ? 'with detected textual elements,' : '',
        hasGraphics ? 'identified graphic elements,' : '',
        `${complexity} complexity,`,
        `${dataLength > 500000 ? 'large' : 'standard'} data size.`,
        'Format compatible with computer vision processing.'
      ].filter(Boolean).join(' ')
    };

    return descriptions[style as keyof typeof descriptions] || descriptions.detailed;
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