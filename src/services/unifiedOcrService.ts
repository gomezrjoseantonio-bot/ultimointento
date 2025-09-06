// Unified OCR Service for calling /.netlify/functions/ocr
// Implements exact requirements from problem statement

export interface OCRResponse {
  success: boolean;
  data?: {
    supplier_name?: string;
    supplier_tax_id?: string;
    total_amount?: number;
    issue_date?: string;
    due_date?: string;
    service_address?: string;
    iban_mask?: string;
    utility_type?: 'Luz' | 'Agua' | 'Gas' | 'Internet';
    categories?: {
      mejora?: number;
      mobiliario?: number;
      reparacion_conservacion?: number;
    };
    raw_text?: string;
  };
  error?: string;
  code?: string;
  status?: number;
}

export class UnifiedOCRService {
  private static instance: UnifiedOCRService;
  
  static getInstance(): UnifiedOCRService {
    if (!UnifiedOCRService.instance) {
      UnifiedOCRService.instance = new UnifiedOCRService();
    }
    return UnifiedOCRService.instance;
  }

  /**
   * Process document through OCR endpoint
   * @param file - File to process (PDF/JPG/PNG/HEIC/DOC/DOCX)
   * @returns OCR result with extracted fields
   */
  async processDocument(file: File): Promise<OCRResponse> {
    try {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/heic',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx'];
      const extension = file.name.toLowerCase().split('.').pop();

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension || '')) {
        throw new Error(`Tipo de archivo no soportado para OCR: ${file.type}`);
      }

      // Convert file to binary data
      const fileBuffer = await file.arrayBuffer();
      
      // Call Netlify function with binary data
      const response = await fetch('/.netlify/functions/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: fileBuffer
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.message || 'Error en el procesamiento OCR',
          code: result.code,
          status: response.status
        };
      }

      // Transform Document AI response to our format
      return this.transformDocumentAIResponse(result);

    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en OCR',
        status: 500
      };
    }
  }

  /**
   * Transform Document AI response to our standard format
   */
  private transformDocumentAIResponse(documentAIResult: any): OCRResponse {
    try {
      const entities = documentAIResult.document?.entities || [];
      const rawText = documentAIResult.document?.text || '';

      const data: OCRResponse['data'] = {
        raw_text: rawText
      };

      // Extract entities with confidence filtering
      entities.forEach((entity: any) => {
        if (entity.confidence < 0.5) return; // Skip low confidence entities

        switch (entity.type) {
          case 'supplier_name':
            data.supplier_name = entity.mentionText?.trim();
            break;
          case 'supplier_tax_id':
            data.supplier_tax_id = entity.mentionText?.trim();
            break;
          case 'total_amount':
            const amount = this.parseAmount(entity);
            if (amount) data.total_amount = amount;
            break;
          case 'invoice_date':
            data.issue_date = this.parseDate(entity);
            break;
          case 'due_date':
            data.due_date = this.parseDate(entity);
            break;
          case 'service_address':
            data.service_address = entity.mentionText?.trim();
            break;
        }
      });

      // Detect utility type from text
      data.utility_type = this.detectUtilityType(rawText);

      // Detect IBAN with masking
      data.iban_mask = this.extractIbanMask(rawText);

      return {
        success: true,
        data
      };

    } catch (error) {
      return {
        success: false,
        error: 'Error transformando respuesta de Document AI'
      };
    }
  }

  private parseAmount(entity: any): number | undefined {
    if (entity.normalizedValue?.moneyValue) {
      const money = entity.normalizedValue.moneyValue;
      return parseFloat(money.units) + (money.nanos || 0) / 1e9;
    }
    
    // Fallback: parse from text
    const text = entity.mentionText?.replace(/[^0-9,.-]/g, '');
    if (text) {
      return parseFloat(text.replace(',', '.'));
    }
    
    return undefined;
  }

  private parseDate(entity: any): string | undefined {
    if (entity.normalizedValue?.dateValue) {
      const date = entity.normalizedValue.dateValue;
      return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    }
    
    // Fallback: parse from text (DD/MM/YYYY format)
    const text = entity.mentionText;
    const dateMatch = text?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return undefined;
  }

  private detectUtilityType(text: string): 'Luz' | 'Agua' | 'Gas' | 'Internet' | undefined {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('electricidad') || lowerText.includes('luz') || lowerText.includes('kwh') || 
        lowerText.includes('iberdrola') || lowerText.includes('endesa')) {
      return 'Luz';
    }
    
    if (lowerText.includes('agua') || lowerText.includes('aqualia') || lowerText.includes('canal')) {
      return 'Agua';
    }
    
    if (lowerText.includes('gas') || lowerText.includes('naturgy')) {
      return 'Gas';
    }
    
    if (lowerText.includes('internet') || lowerText.includes('fibra') || lowerText.includes('telefon') ||
        lowerText.includes('movistar') || lowerText.includes('orange') || lowerText.includes('vodafone')) {
      return 'Internet';
    }
    
    return undefined;
  }

  private extractIbanMask(text: string): string | undefined {
    // Look for IBAN patterns with potential masking
    const ibanPattern = /ES\d{2}\s*\d{4}\s*\d{4}\s*\d{2}\s*[\d*•]{12}/g;
    const match = text.match(ibanPattern);
    
    if (match) {
      return match[0].replace(/\s/g, ''); // Remove spaces
    }
    
    // Look for partial IBAN with asterisks
    const partialPattern = /ES\d{2}[\s\d*•]{18,24}/g;
    const partialMatch = text.match(partialPattern);
    
    if (partialMatch) {
      return partialMatch[0].replace(/\s/g, '');
    }
    
    return undefined;
  }

  /**
   * Test OCR endpoint (DEV only)
   */
  async testOCREndpoint(): Promise<{ status: number; message: string }> {
    try {
      // Create a minimal test file
      const testData = new ArrayBuffer(100);
      
      const response = await fetch('/.netlify/functions/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: testData
      });

      return {
        status: response.status,
        message: response.ok ? 'OCR endpoint disponible' : 'OCR endpoint no responde correctamente'
      };

    } catch (error) {
      return {
        status: 0,
        message: 'Error conectando con OCR endpoint'
      };
    }
  }
}

export const unifiedOcrService = UnifiedOCRService.getInstance();