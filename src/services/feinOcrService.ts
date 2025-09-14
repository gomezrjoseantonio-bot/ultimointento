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

// New interface for the updated flow
export interface FEINServiceResponse {
  mode: 'sync' | 'background';
  result?: FEINProcessingResult;
  jobId?: string;
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

      // Parse response
      const json = await response.json();
      
      // Handle 200 (sync) response
      if (response.status === 200) {
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] mode', 'sync', null);
        }
        
        console.info('[FEIN] DocAI response', json);

        onProgress?.({
          currentPage: 1,
          totalPages: 1,
          stage: 'complete',
          message: 'Procesamiento completado'
        });

        // Assert success and return sync result
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

        return this.processCompletedResult(json, file.name, startTime);
      }

      // Handle 202 (background) response
      if (response.status === 202) {
        const { jobId } = json;
        
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] mode', 'background', jobId);
        }
        
        onProgress?.({
          currentPage: 1,
          totalPages: 1,
          stage: 'processing',
          message: 'Procesando FEIN en segundo plano...'
        });

        // Start polling
        return await this.pollForResult(jobId, onProgress, file.name, startTime);
      }

      // Unexpected status code
      return {
        success: false,
        errors: [`Respuesta inesperada del servidor: ${response.status}`],
        warnings: [],
        fieldsExtracted: [],
        fieldsMissing: ['all'],
        pendingFields: ['all']
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
   * New method: Process FEIN PDF and return sync/background mode
   * @param file - PDF file  
   * @param onProgress - Progress callback for UI updates
   * @returns Promise with mode and result or jobId
   */
  async processFEINDocumentNew(
    file: File, 
    onProgress?: ProgressCallback
  ): Promise<FEINServiceResponse> {
    const startTime = performance.now();
    
    onProgress?.({
      currentPage: 1,
      totalPages: 1,
      stage: 'uploading',
      message: 'Preparando documento...'
    });

    // Validate file
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      return {
        mode: 'sync',
        result: {
          success: false,
          errors: [validation.error!],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: ['all'],
          pendingFields: ['all']
        }
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/.netlify/functions/ocr-fein', {
        method: 'POST',
        body: formData
      });

      // Parse response
      const json = await response.json();
      
      // Handle 200 (sync) response
      if (response.status === 200) {
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] mode', 'sync');
        }

        // Assert success and return sync result
        if (!json.success) {
          return {
            mode: 'sync',
            result: {
              success: false,
              errors: [json.error || 'Error procesando documento con DocAI'],
              warnings: [],
              fieldsExtracted: [],
              fieldsMissing: ['all'],
              pendingFields: ['all'],
              providerUsed: json.providerUsed
            }
          };
        }

        const result = this.processCompletedResult(json, file.name, startTime);
        return {
          mode: 'sync',
          result
        };
      }

      // Handle 202 (background) response
      if (response.status === 202) {
        const { jobId } = json;
        
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] mode', 'background', jobId);
        }

        return {
          mode: 'background',
          jobId
        };
      }

      // Unexpected status code
      return {
        mode: 'sync',
        result: {
          success: false,
          errors: [`Respuesta inesperada del servidor: ${response.status}`],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: ['all'],
          pendingFields: ['all']
        }
      };

    } catch (error) {
      console.error('[FEIN] Error processing FEIN document:', error);
      
      return {
        mode: 'sync',
        result: {
          success: false,
          errors: ['Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.'],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: ['all'],
          pendingFields: ['all']
        }
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
    // Protection: if fields doesn't exist yet, return empty draft with pending fields
    if (!fields || typeof fields !== 'object') {
      return {
        metadata: {
          sourceFileName,
          pagesTotal: 1,
          pagesProcessed: 1,
          ocrProvider: 'docai',
          processedAt: new Date().toISOString(),
          warnings: ['Campos aún no procesados']
        },
        prestamo: {
          tipo: null,
          periodicidadCuota: 'MENSUAL',
          revisionMeses: null,
          indiceReferencia: null,
          valorIndiceActual: null,
          diferencial: null,
          tinFijo: null,
          comisionAperturaPct: null,
          comisionMantenimientoMes: null,
          amortizacionAnticipadaPct: null,
          fechaFirmaPrevista: null,
          banco: null,
          capitalInicial: undefined,
          plazoMeses: undefined,
          ibanCargoParcial: null
        },
        bonificaciones: []
      };
    }

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
        revisionMeses: this.extractRevisionMeses(fields?.plazoMeses),
        indiceReferencia: fields?.indice ? 'EURIBOR' : null,
        valorIndiceActual: null,
        diferencial: fields?.diferencial ? parseFloat(fields.diferencial.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        tinFijo: fields?.tin ? parseFloat(fields.tin.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        comisionAperturaPct: this.extractComisionUndefined(fields?.comisiones, 'apertura'),
        comisionMantenimientoMes: this.extractComisionUndefined(fields?.comisiones, 'mantenimiento'),
        amortizacionAnticipadaPct: this.extractComisionUndefined(fields?.comisiones, 'amortizacion'),
        fechaFirmaPrevista: fields?.fechaOferta || null,
        banco: this.extractBanco(fields),
        capitalInicial: this.extractAmount(fields?.capital_inicial),
        plazoMeses: this.extractNumber(fields?.plazoMeses) ?? undefined,
        ibanCargoParcial: fields?.cuentaCargo || null
      },
      bonificaciones: this.extractBonificaciones(fields?.vinculaciones)
    };
  }

  /**
   * Analyze fields to determine extracted vs missing
   */
  private analyzeFields(fields: any): { fieldsExtracted: string[]; fieldsMissing: string[] } {
    const fieldsExtracted: string[] = [];
    const fieldsMissing: string[] = [];
    
    // Protection: if fields doesn't exist yet, all fields are missing
    if (!fields || typeof fields !== 'object') {
      return {
        fieldsExtracted: [],
        fieldsMissing: ['capitalInicial', 'plazoMeses', 'tin', 'cuota', 'indice', 'diferencial', 'cuentaCargo']
      };
    }
    
    // Check critical fields with optional chaining
    if (fields?.capital_inicial) fieldsExtracted.push('capitalInicial');
    else fieldsMissing.push('capitalInicial');
    
    if (fields?.plazoMeses) fieldsExtracted.push('plazoMeses');
    else fieldsMissing.push('plazoMeses');
    
    if (fields?.tin || fields?.tae) fieldsExtracted.push('tin');
    else fieldsMissing.push('tin');
    
    if (fields?.cuota) fieldsExtracted.push('cuota');
    else fieldsMissing.push('cuota');
    
    if (fields?.indice) fieldsExtracted.push('indice');
    else fieldsMissing.push('indice');
    
    if (fields?.diferencial) fieldsExtracted.push('diferencial');
    else fieldsMissing.push('diferencial');
    
    if (fields?.cuentaCargo) fieldsExtracted.push('cuentaCargo');
    else fieldsMissing.push('cuentaCargo');
    
    return { fieldsExtracted, fieldsMissing };
  }

  // Helper methods for field extraction
  private extractTipoFromFields(fields: any): 'FIJO' | 'VARIABLE' | 'MIXTO' | null {
    if (!fields) return null;
    if (fields?.tin && fields?.diferencial) return 'VARIABLE';
    if (fields?.tin && !fields?.diferencial) return 'FIJO';
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
    if (!fields) return null;
    return fields?.banco || fields?.entidad || null;
  }

  private extractBonificaciones(vinculaciones: any): any[] {
    if (!Array.isArray(vinculaciones)) return [];
    return vinculaciones.map(v => ({
      tipo: v,
      aplicada: false,
      descuentoPct: null
    }));
  }

  /**
   * Process completed result from sync or async response
   */
  private processCompletedResult(json: any, fileName: string, startTime: number): FEINProcessingResult {
    // Map DocAI fields to loan draft structure
    const loanDraft = this.mapFieldsToLoanDraft(json.fields, fileName);
    
    // Determine extracted and missing fields
    const { fieldsExtracted, fieldsMissing } = this.analyzeFields(json.fields);
    
    const processingTimeMs = Math.round(performance.now() - startTime);
    console.log(`[FEIN] Processing completed in ${processingTimeMs}ms`);
    
    return {
      success: true,
      loanDraft,
      confidence: json.confidenceGlobal,
      errors: [],
      warnings: json.pending?.length > 0 ? [`${json.pending.length} campos marcados como pendientes`] : [],
      fieldsExtracted,
      fieldsMissing,
      pendingFields: json.pending || [],
      providerUsed: json.providerUsed,
      data: loanDraft // For compatibility
    };
  }

  /**
   * Poll for background processing result
   */
  private async pollForResult(
    jobId: string, 
    onProgress?: ProgressCallback, 
    fileName?: string, 
    startTime?: number
  ): Promise<FEINProcessingResult> {
    const POLL_INTERVAL_MS = 2000; // 2 seconds
    const MAX_POLL_TIME_MS = 60000; // 60 seconds
    const MAX_ATTEMPTS = Math.floor(MAX_POLL_TIME_MS / POLL_INTERVAL_MS); // 30 attempts
    
    let attempts = 0;
    
    while (attempts < MAX_ATTEMPTS) {
      try {
        attempts++;
        
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] polling attempt', attempts);
        }
        
        const response = await fetch(`/.netlify/functions/ocr-fein?jobId=${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] polling status', result.status);
        }
        
        onProgress?.({
          currentPage: 1,
          totalPages: 1,
          stage: 'processing',
          message: `Procesando FEIN en segundo plano... (${attempts}/${MAX_ATTEMPTS})`
        });
        
        if (result.success && result.status === 'completed' && result.result) {
          // Processing completed successfully
          onProgress?.({
            currentPage: 1,
            totalPages: 1,
            stage: 'complete',
            message: 'Procesamiento completado'
          });
          
          return this.processCompletedResult(result.result, fileName || 'unknown.pdf', startTime || performance.now());
        }
        
        if (result.status === 'failed') {
          // Processing failed
          return {
            success: false,
            errors: [result.message || 'Error procesando documento en segundo plano'],
            warnings: [],
            fieldsExtracted: [],
            fieldsMissing: ['all'],
            pendingFields: ['all']
          };
        }
        
        // Still pending/processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        
      } catch (error) {
        console.error(`[FEIN] Polling attempt ${attempts} failed:`, error);
        
        // On the last attempt, return error
        if (attempts >= MAX_ATTEMPTS) {
          return {
            success: false,
            errors: ['Error verificando el estado del procesamiento'],
            warnings: [],
            fieldsExtracted: [],
            fieldsMissing: ['all'],
            pendingFields: ['all']
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
    
    // Timeout reached
    return {
      success: false,
      errors: ['Tiempo de espera agotado. Intenta de nuevo'],
      warnings: [],
      fieldsExtracted: [],
      fieldsMissing: ['all'],
      pendingFields: ['all']
    };
  }

  /**
   * New polling method for background processing result with proper 404 handling
   */
  async pollForBackgroundResult(
    jobId: string, 
    onProgress?: (progress: { percent: number; message: string }) => void
  ): Promise<FEINProcessingResult> {
    const POLL_INTERVAL_MS = 2000; // 2 seconds
    const MAX_POLL_TIME_MS = 60000; // 60 seconds
    const MAX_ATTEMPTS = Math.floor(MAX_POLL_TIME_MS / POLL_INTERVAL_MS); // 30 attempts
    const MAX_404_RETRIES = 5; // 404 retry limit
    
    let attempts = 0;
    let notFoundRetries = 0;
    
    while (attempts < MAX_ATTEMPTS) {
      try {
        attempts++;
        
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] polling', { status: 'polling', percent: Math.round((attempts / MAX_ATTEMPTS) * 100) });
        }
        
        const response = await fetch(`/.netlify/functions/ocr-fein?jobId=${jobId}`);
        
        // Handle 404 - job not ready yet
        if (response.status === 404) {
          notFoundRetries++;
          if (notFoundRetries <= MAX_404_RETRIES) {
            // Wait 1 second and retry for 404s
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          } else {
            throw new Error('Job not found after multiple retries');
          }
        }
        
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Telemetry logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('[FEIN] polling', { status: result.status, percent: result.progress?.percent || 0 });
        }
        
        // Update progress with backend progress
        onProgress?.({
          percent: result.progress?.percent || Math.round((attempts / MAX_ATTEMPTS) * 70), // Fallback to simulated progress
          message: 'Procesando FEIN...'
        });
        
        if (result.success && result.status === 'completed' && result.result) {
          // Processing completed successfully
          if (process.env.NODE_ENV === 'development') {
            console.info('[FEIN] completed', result.result.providerUsed, result.result.confidenceGlobal);
          }
          
          // Use the backend result directly
          const loanDraft = this.mapFieldsToLoanDraft(result.result.fields, 'background-processed.pdf');
          const { fieldsExtracted, fieldsMissing } = this.analyzeFields(result.result.fields);
          
          return {
            success: true,
            loanDraft,
            confidence: result.result.confidenceGlobal,
            errors: [],
            warnings: result.result.pending?.length > 0 ? [`${result.result.pending.length} campos marcados como pendientes`] : [],
            fieldsExtracted,
            fieldsMissing,
            pendingFields: result.result.pending || [],
            providerUsed: result.result.providerUsed,
            data: loanDraft
          };
        }
        
        if (result.status === 'failed') {
          // Processing failed
          return {
            success: false,
            errors: [result.message || 'No hemos podido procesar la FEIN. Revisa el documento o inténtalo de nuevo.'],
            warnings: [],
            fieldsExtracted: [],
            fieldsMissing: ['all'],
            pendingFields: ['all']
          };
        }
        
        // Still pending/processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        
      } catch (error) {
        console.error(`[FEIN] Polling attempt ${attempts} failed:`, error);
        
        // On the last attempt, return error
        if (attempts >= MAX_ATTEMPTS) {
          return {
            success: false,
            errors: ['Error verificando el estado del procesamiento'],
            warnings: [],
            fieldsExtracted: [],
            fieldsMissing: ['all'],
            pendingFields: ['all']
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
    
    // Timeout reached
    return {
      success: false,
      errors: ['Tardando más de lo habitual. Inténtalo de nuevo.'],
      warnings: [],
      fieldsExtracted: [],
      fieldsMissing: ['all'],
      pendingFields: ['all']
    };
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

  /**
   * New secure field mapping function per requirements
   * Safely converts ES formatted numbers and maps fields with optional chaining
   */
  static mapFieldsToLoanDraft(fields: any, pending: string[]): any {
    if (!fields) return {};

    const parseEsAmount = (value: string | number | undefined): number | undefined => {
      if (!value) return undefined;
      if (typeof value === 'number') return value;
      
      // Parse ES format: "1.234,56 €" → 1234.56
      const cleaned = value.toString()
        .replace(/[€\s]/g, '')  // Remove € and spaces
        .replace(/\./g, '')     // Remove thousands separators
        .replace(',', '.');     // Replace decimal comma with dot
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    };

    const parseEsPercentage = (value: string | number | undefined): number | undefined => {
      if (!value) return undefined;
      if (typeof value === 'number') return value;
      
      // Parse ES format: "3,25 %" → 3.25
      const cleaned = value.toString()
        .replace(/[%\s]/g, '')  // Remove % and spaces
        .replace(',', '.');     // Replace decimal comma with dot
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    };

    const formatIban = (iban: string | undefined): string | undefined => {
      if (!iban) return undefined;
      
      // Remove spaces and format with spaces every 4 characters
      const cleaned = iban.replace(/\s/g, '');
      return cleaned.replace(/(.{4})/g, '$1 ').trim();
    };

    // Map fields with optional chaining
    const draft: any = {};

    // Prestamo section
    if (fields?.capital_inicial !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.capitalInicial = parseEsAmount(fields.capital_inicial);
    }

    if (fields?.plazoMeses !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.plazoMeses = parseEsAmount(fields.plazoMeses);
    }

    if (fields?.tin !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.tinPct = parseEsPercentage(fields.tin);
    }

    if (fields?.tae !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.taePct = parseEsPercentage(fields.tae);
    }

    if (fields?.cuota !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.cuotaEstim = parseEsAmount(fields.cuota);
    }

    if (fields?.sistemaAmortizacion !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.sistema = fields.sistemaAmortizacion; // 'FRANCES'|'ALEMAN'|...
    }

    if (fields?.indice !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.indice = fields.indice; // 'EURIBOR_12M'|...
    }

    if (fields?.diferencial !== undefined) {
      draft.prestamo = draft.prestamo || {};
      draft.prestamo.diferencialPct = parseEsPercentage(fields.diferencial);
    }

    // Cuenta cargo section
    if (fields?.cuentaCargo !== undefined) {
      draft.cuentaCargo = draft.cuentaCargo || {};
      draft.cuentaCargo.iban = formatIban(fields.cuentaCargo);
    }

    // Bonificaciones
    if (fields?.vinculaciones && Array.isArray(fields.vinculaciones)) {
      draft.bonificaciones = fields.vinculaciones;
    }

    // Costes section  
    if (fields?.comisiones !== undefined) {
      draft.costes = draft.costes || {};
      draft.costes.comisiones = fields.comisiones;
    }

    if (fields?.gastos !== undefined) {
      draft.costes = draft.costes || {};
      draft.costes.gastos = fields.gastos;
    }

    return draft;
  }

  /**
   * Apply FEIN result to form with deep merge preserving user input
   */
  static applyFeinToForm(result: any, currentForm: any, setFormValues: (updater: (prev: any) => any) => void): void {
    if (!result?.fields) return;

    const draft = this.mapFieldsToLoanDraft(result.fields, result.pending || []);
    
    // Deep merge preserving user input (don't overwrite non-null values)
    const deepMergePreservingUser = (target: any, source: any): any => {
      const merged = { ...target };
      
      for (const key in source) {
        if (source[key] !== null && source[key] !== undefined) {
          if (target[key] === null || target[key] === undefined) {
            // Only set if target doesn't have a value
            merged[key] = typeof source[key] === 'object' && !Array.isArray(source[key])
              ? deepMergePreservingUser(target[key] || {}, source[key])
              : source[key];
          }
        }
      }
      
      return merged;
    };

    setFormValues(prev => deepMergePreservingUser(prev, draft));
  }
}

export const feinOcrService = FEINOCRService.getInstance();