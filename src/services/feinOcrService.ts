// FEIN OCR Service - Serverless DocAI only implementation
// Eliminates PDF.js workers and client-side processing
// Uses only /.netlify/functions/ocr-fein for all document processing

import { FeinLoanDraft } from '../types/fein';

interface ProgressCallback {
  (progress: {
    currentPage: number;
    totalPages: number;
    stage: 'uploading' | 'processing' | 'complete';
    message: string;
  }): void;
}

export interface FEINProcessingResult {
  success: boolean;
  loanDraft?: FeinLoanDraft;
  confidence?: number;
  errors: string[];
  warnings: string[];
  fieldsExtracted: string[];
  fieldsMissing: string[];
  pendingFields?: string[];
  providerUsed?: string;
  data?: any; // For compatibility with existing code
}

export class FEINOCRService {
  private static instance: FEINOCRService;
  
  // Constants for file validation
  private readonly MAX_PDF_SIZE = 8 * 1024 * 1024; // 8MB max PDF size (serverless limit)
  
  static getInstance(): FEINOCRService {
    if (!FEINOCRService.instance) {
      FEINOCRService.instance = new FEINOCRService();
    }
    return FEINOCRService.instance;
  }

  /**
   * Main method: Process FEIN PDF using serverless DocAI only
   * @param file - PDF file
   * @param onProgress - Progress callback for UI updates
   * @returns Promise with loan draft and processing results
   */
  async processFEINDocument(
    file: File, 
    onProgress?: ProgressCallback
  ): Promise<FEINProcessingResult> {
    const startTime = performance.now();
    
    console.log('[FEIN] Processing document:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          errors: [validation.error!],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: ['all'], // All fields missing if validation failed
          pendingFields: ['all']
        };
      }

      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        stage: 'uploading',
        message: 'Subiendo documento para análisis...'
      });

      // Call serverless function with PDF blob
      const response = await fetch('/.netlify/functions/ocr-fein', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf'
        },
        body: file
      });

      onProgress?.({
        currentPage: 1,
        totalPages: 1,
        stage: 'processing',
        message: 'Procesando documento con DocAI...'
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Error procesando documento FEIN';
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          } else if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          errorMessage = errorText.slice(0, 200) || 'Error de comunicación con el servidor';
        }

        return {
          success: false,
          errors: [errorMessage],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: ['all'],
          pendingFields: ['all']
        };
      }

      // Parse response from DocAI
      const json = await response.json();
      
      // Log DocAI response for validation
      console.info('[FEIN] DocAI response', json);

      onProgress?.({
        currentPage: 1,
        totalPages: 1,
        stage: 'complete',
        message: 'Procesamiento completado'
      });

      // Handle DocAI response
      if (!json.success) {
        return {
          success: false,
          errors: [json.error || 'Error procesando documento con DocAI'],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: ['all'],
          pendingFields: ['all'],
          providerUsed: json.providerUsed
        };
      }

      // Map DocAI fields to loan draft structure
      const loanDraft = this.mapFieldsToLoanDraft(json.fields, file.name);
      
      // Determine extracted and missing fields
      const { fieldsExtracted, fieldsMissing } = this.analyzeFields(json.fields);
      
      const processingTimeMs = Math.round(performance.now() - startTime);
      console.log(`[FEIN] Processing completed in ${processingTimeMs}ms`);
      
      return {
        success: true,
        loanDraft,
        confidence: json.confidenceGlobal,
        errors: [],
        warnings: json.pending.length > 0 ? [`${json.pending.length} campos marcados como pendientes`] : [],
        fieldsExtracted,
        fieldsMissing,
        pendingFields: json.pending,
        providerUsed: json.providerUsed,
        data: loanDraft // For compatibility
      };

    } catch (error) {
      console.error('[FEIN] Error processing FEIN document:', error);
      
      return {
        success: false,
        errors: ['Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.'],
        warnings: [],
        fieldsExtracted: [],
        fieldsMissing: ['all'],
        pendingFields: ['all']
      };
    }
  }

  /**
   * Validate PDF file
   */
  private validateFile(file: File): { isValid: boolean; error?: string } {
    if (file.type !== 'application/pdf') {
      return {
        isValid: false,
        error: 'Solo se permiten archivos PDF para documentos FEIN'
      };
    }

    if (file.size > this.MAX_PDF_SIZE) {
      return {
        isValid: false,
        error: `Archivo demasiado grande. Máximo ${this.MAX_PDF_SIZE / (1024 * 1024)}MB`
      };
    }

    return { isValid: true };
  }

  /**
   * Map DocAI normalized fields to FeinLoanDraft structure
   */
  private mapFieldsToLoanDraft(fields: any, sourceFileName: string): FeinLoanDraft {
    return {
      metadata: {
        sourceFileName,
        pagesTotal: 1, // Not relevant for serverless processing
        pagesProcessed: 1,
        ocrProvider: 'docai',
        processedAt: new Date().toISOString(),
        warnings: []
      },
      prestamo: {
        tipo: this.extractTipoFromFields(fields),
        periodicidadCuota: 'MENSUAL', // Default for FEIN
        revisionMeses: this.extractRevisionMeses(fields.plazoMeses),
        indiceReferencia: fields.indice ? 'EURIBOR' : null,
        valorIndiceActual: null,
        diferencial: fields.diferencial ? parseFloat(fields.diferencial.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        tinFijo: fields.tin ? parseFloat(fields.tin.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        comisionAperturaPct: this.extractComisionUndefined(fields.comisiones, 'apertura'),
        comisionMantenimientoMes: this.extractComisionUndefined(fields.comisiones, 'mantenimiento'),
        amortizacionAnticipadaPct: this.extractComisionUndefined(fields.comisiones, 'amortizacion'),
        fechaFirmaPrevista: fields.fechaOferta || null,
        banco: this.extractBanco(fields),
        capitalInicial: this.extractAmount(fields.capital_inicial),
        plazoMeses: this.extractNumber(fields.plazoMeses) ?? undefined,
        ibanCargoParcial: fields.cuentaCargo || null
      },
      bonificaciones: this.extractBonificaciones(fields.vinculaciones)
    };
  }

  /**
   * Analyze fields to determine extracted vs missing
   */
  private analyzeFields(fields: any): { fieldsExtracted: string[]; fieldsMissing: string[] } {
    const fieldsExtracted: string[] = [];
    const fieldsMissing: string[] = [];
    
    // Check critical fields
    if (fields.capital_inicial) fieldsExtracted.push('capitalInicial');
    else fieldsMissing.push('capitalInicial');
    
    if (fields.plazoMeses) fieldsExtracted.push('plazoMeses');
    else fieldsMissing.push('plazoMeses');
    
    if (fields.tin || fields.tae) fieldsExtracted.push('tin');
    else fieldsMissing.push('tin');
    
    if (fields.cuota) fieldsExtracted.push('cuota');
    else fieldsMissing.push('cuota');
    
    if (fields.indice) fieldsExtracted.push('indice');
    else fieldsMissing.push('indice');
    
    if (fields.diferencial) fieldsExtracted.push('diferencial');
    else fieldsMissing.push('diferencial');
    
    if (fields.cuentaCargo) fieldsExtracted.push('cuentaCargo');
    else fieldsMissing.push('cuentaCargo');
    
    return { fieldsExtracted, fieldsMissing };
  }

  // Helper methods for field extraction
  private extractTipoFromFields(fields: any): 'FIJO' | 'VARIABLE' | 'MIXTO' | null {
    if (fields.tin && fields.diferencial) return 'VARIABLE';
    if (fields.tin && !fields.diferencial) return 'FIJO';
    return null;
  }

  private extractRevisionMeses(plazoValue: any): 6 | 12 | null {
    const plazo = this.extractNumber(plazoValue);
    if (!plazo) return null;
    // Default to 12 months for variable rates
    return 12;
  }

  private extractNumber(value: any): number | null {
    if (!value) return null;
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : value;
    return isNaN(num) ? null : num;
  }

  private extractAmount(value: any): number | undefined {
    if (!value) return undefined;
    const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(cleanValue);
    return isNaN(num) ? undefined : num;
  }

  private extractComision(comisiones: any, tipo: string): number | null {
    if (!comisiones || typeof comisiones !== 'object') return null;
    const value = comisiones[tipo];
    return this.extractNumber(value);
  }

  private extractComisionUndefined(comisiones: any, tipo: string): number | undefined {
    if (!comisiones || typeof comisiones !== 'object') return undefined;
    const value = comisiones[tipo];
    const num = this.extractNumber(value);
    return num ?? undefined;
  }

  private extractBanco(fields: any): string | null {
    // Try to extract bank name from various possible fields
    return fields.banco || fields.entidad || null;
  }

  private extractBonificaciones(vinculaciones: any): any[] {
    if (!Array.isArray(vinculaciones)) return [];
    return vinculaciones.map(v => ({
      tipo: v,
      aplicada: false,
      descuentoPct: null
    }));
  }

  // Legacy methods for backward compatibility (deprecated)
  async processFEINDocumentChunked(file: File): Promise<any> {
    console.warn('[FEIN] Using deprecated chunked method - redirecting to new implementation');
    const result = await this.processFEINDocument(file);
    
    return {
      success: result.success,
      jobId: 'legacy-' + Date.now(),
      pagesTotal: 1,
      totalChunks: 1,
      error: result.errors.length > 0 ? result.errors[0] : undefined
    };
  }

  async checkFEINJobStatus(jobId: string): Promise<any> {
    console.warn('[FEIN] checkFEINJobStatus is deprecated with new implementation');
    return {
      success: false,
      error: 'Método obsoleto - use processFEINDocument directamente'
    };
  }
}

export const feinOcrService = FEINOCRService.getInstance();