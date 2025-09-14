// FEIN OCR Service - Rewritten for "texto-primero, OCR-después" pattern
// Implements client-side PDF text extraction with page-by-page OCR for scanned pages
// Following problem statement requirements to avoid ResponseSizeTooLarge errors

import * as pdfjsLib from 'pdfjs-dist';
import { FeinLoanDraft } from '../types/fein';
import { FeinTextParser } from './fein/parseFeinText';

// Set up PDF.js worker - Use local static file to avoid CSP issues
// No dynamic imports - worker loaded directly from static asset
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PageProcessingResult {
  pageNumber: number;
  text: string;
  hasNativeText: boolean;
  needsOCR: boolean;
  ocrResult?: string;
  error?: string;
}

interface ProgressCallback {
  (progress: {
    currentPage: number;
    totalPages: number;
    stage: 'extracting' | 'ocr' | 'parsing' | 'complete';
    message: string;
  }): void;
}

export interface FEINProcessingResult {
  success: boolean;
  loanDraft?: FeinLoanDraft;
  confidence?: number;
  errors: string[];
  warnings: string[];
  pagesProcessed: number;
  ocrPagesUsed: number;
  fieldsExtracted: string[];
  fieldsMissing: string[];
  pendingFields?: string[]; // New field for UX "Pendiente" pattern
  telemetry?: FEINTelemetryData; // New telemetry data
  data?: any; // For compatibility with existing code
}

// New telemetry interface for audit and performance tracking
export interface FEINTelemetryData {
  docId: string;
  pages: number[];
  processingTimeMs: number;
  fileSizeKB: number;
  ocrUsed: boolean[];
  workerLoadTimeMs?: number;
  errors: string[];
  pageProcessingTimes: Record<number, number>;
  textToOcrRatio: number; // Percentage of pages that used text vs OCR
  confidence: number;
  pendingFieldReasons: Record<string, string>; // Why each field is pending
}

export class FEINOCRService {
  private static instance: FEINOCRService;
  
  // Constants following problem statement requirements
  private readonly MIN_TEXT_RATIO = 200; // Minimum characters per page to skip OCR
  private readonly MAX_CONCURRENT_OCR = 2; // Limit concurrent OCR requests
  private readonly MAX_IMAGE_WIDTH = 1600; // Max image width for OCR
  private readonly MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB max PDF size
  private readonly WORKER_LOAD_TIMEOUT_MS = 200; // Worker should load in < 200ms
  
  static getInstance(): FEINOCRService {
    if (!FEINOCRService.instance) {
      FEINOCRService.instance = new FEINOCRService();
    }
    return FEINOCRService.instance;
  }

  /**
   * Check if PDF.js worker loads correctly and measure performance
   * Logs worker_ok event if loading exceeds 200ms threshold
   */
  private async checkWorkerPerformance(): Promise<{ workerOk: boolean; loadTimeMs: number }> {
    const startTime = performance.now();
    
    try {
      // Create a minimal PDF to test worker loading
      const testArrayBuffer = new ArrayBuffer(8);
      const loadingTask = pdfjsLib.getDocument({ data: testArrayBuffer });
      
      // Set timeout for worker loading test
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Worker loading timeout')), this.WORKER_LOAD_TIMEOUT_MS)
      );
      
      try {
        await Promise.race([loadingTask.promise, timeoutPromise]);
        const loadTimeMs = performance.now() - startTime;
        
        // Log event if worker loading exceeds threshold
        if (loadTimeMs >= this.WORKER_LOAD_TIMEOUT_MS) {
          console.warn(`[FEIN-WORKER] Worker loading slow: ${loadTimeMs.toFixed(2)}ms (threshold: ${this.WORKER_LOAD_TIMEOUT_MS}ms)`);
        } else {
          console.log(`[FEIN-WORKER] Worker loaded successfully in ${loadTimeMs.toFixed(2)}ms`);
        }
        
        return { workerOk: true, loadTimeMs };
      } catch (error) {
        const loadTimeMs = performance.now() - startTime;
        console.warn('[FEIN-WORKER] PDF.js worker loading issue:', error);
        
        // Log worker loading failure event
        console.error(`[FEIN-WORKER] Worker failed to load in ${loadTimeMs.toFixed(2)}ms`);
        
        return { workerOk: false, loadTimeMs };
      }
    } catch (error) {
      const loadTimeMs = performance.now() - startTime;
      console.error('[FEIN-WORKER] PDF.js worker check failed:', error);
      return { workerOk: false, loadTimeMs };
    }
  }

  /**
   * Log structured telemetry data per problem statement requirements
   * Format: {docId, pages:[...], ms, sizeKB, ocrUsed:[true/false], errors[]}
   */
  private logTelemetry(telemetry: FEINTelemetryData): void {
    console.log('[FEIN-TELEMETRY]', JSON.stringify({
      docId: telemetry.docId,
      pages: telemetry.pages,
      ms: telemetry.processingTimeMs,
      sizeKB: telemetry.fileSizeKB,
      ocrUsed: telemetry.ocrUsed,
      errors: telemetry.errors,
      worker_ok: (telemetry.workerLoadTimeMs || 0) < this.WORKER_LOAD_TIMEOUT_MS,
      worker_load_ms: telemetry.workerLoadTimeMs,
      pages_ocr: telemetry.ocrUsed.filter(used => used).length,
      pages_text: telemetry.ocrUsed.filter(used => !used).length,
      textToOcrRatio: telemetry.textToOcrRatio,
      confidence: telemetry.confidence,
      pendingFieldsCount: Object.keys(telemetry.pendingFieldReasons).length,
      pendingFieldReasons: telemetry.pendingFieldReasons
    }));
  }

  /**
   * Main method: Process FEIN PDF using "texto-primero, OCR-después" pattern
   * @param file - PDF file
   * @param onProgress - Progress callback for UI updates
   * @returns Promise with loan draft and processing results
   */
  async processFEINDocument(
    file: File, 
    onProgress?: ProgressCallback
  ): Promise<FEINProcessingResult> {
    const startTime = performance.now();
    const docId = `fein_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    console.log('[FEIN] Processing document:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`, `docId: ${docId}`);
    
    // Initialize telemetry
    const telemetry: FEINTelemetryData = {
      docId,
      pages: [],
      processingTimeMs: 0,
      fileSizeKB: Math.round(file.size / 1024),
      ocrUsed: [],
      errors: [],
      pageProcessingTimes: {},
      textToOcrRatio: 0,
      confidence: 0,
      pendingFieldReasons: {}
    };

    try {
      // Check worker performance first
      const workerCheck = await this.checkWorkerPerformance();
      telemetry.workerLoadTimeMs = workerCheck.loadTimeMs;
      
      if (!workerCheck.workerOk) {
        telemetry.errors.push(`Worker loading failed in ${workerCheck.loadTimeMs}ms`);
        console.warn('[FEIN] PDF.js worker loading issue detected');
      }

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        telemetry.errors.push(validation.error!);
        telemetry.processingTimeMs = performance.now() - startTime;
        this.logTelemetry(telemetry);
        
        return {
          success: false,
          errors: [validation.error!],
          warnings: [],
          pagesProcessed: 0,
          ocrPagesUsed: 0,
          fieldsExtracted: [],
          fieldsMissing: ['all'], // All fields missing if validation failed
          pendingFields: ['all'],
          telemetry
        };
      }

      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        stage: 'extracting',
        message: 'Analizando documento PDF...'
      });

      // Load PDF with PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      telemetry.pages = Array.from({ length: totalPages }, (_, i) => i + 1);

      console.log(`[FEIN] PDF loaded: ${totalPages} pages`);

      // Process each page: extract text first, OCR if needed
      const pageResults: PageProcessingResult[] = [];
      let ocrPagesUsed = 0;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageStartTime = performance.now();
        
        onProgress?.({
          currentPage: pageNum,
          totalPages,
          stage: 'extracting',
          message: `Extrayendo texto de página ${pageNum}/${totalPages}...`
        });

        try {
          const pageResult = await this.processPage(pdf, pageNum);
          pageResults.push(pageResult);

          if (pageResult.needsOCR) {
            ocrPagesUsed++;
            telemetry.ocrUsed[pageNum - 1] = true;
            
            onProgress?.({
              currentPage: pageNum,
              totalPages,
              stage: 'ocr',
              message: `Aplicando OCR a página ${pageNum} (imagen escaneada)...`
            });

            // Perform OCR on this page
            await this.performPageOCR(pdf, pageNum, pageResult);
          } else {
            telemetry.ocrUsed[pageNum - 1] = false;
          }

          // Track page processing time
          const pageProcessingTime = performance.now() - pageStartTime;
          telemetry.pageProcessingTimes[pageNum] = Math.round(pageProcessingTime);

        } catch (error) {
          console.warn(`[FEIN] Error processing page ${pageNum}:`, error);
          pageResults.push({
            pageNumber: pageNum,
            text: '',
            hasNativeText: false,
            needsOCR: false,
            error: `Error procesando página ${pageNum}`
          });
        }

        // Add small delay to prevent UI blocking
        if (pageNum % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      onProgress?.({
        currentPage: totalPages,
        totalPages,
        stage: 'parsing',
        message: 'Analizando información del préstamo...'
      });

      // Aggregate all text and parse
      const aggregatedText = this.aggregatePageText(pageResults);
      
      if (!aggregatedText || aggregatedText.length < 100) {
        telemetry.errors.push('Insufficient text extracted from document');
        telemetry.processingTimeMs = Math.round(performance.now() - startTime);
        this.logTelemetry(telemetry);
        
        return {
          success: false,
          errors: ['No se pudo extraer suficiente texto del documento FEIN. Verifica que el archivo sea legible.'],
          warnings: [],
          pagesProcessed: totalPages,
          ocrPagesUsed,
          fieldsExtracted: [],
          fieldsMissing: ['all'], // All fields missing if no text extracted
          pendingFields: ['all'],
          telemetry
        };
      }

      // Parse FEIN data from aggregated text
      const parseResult = FeinTextParser.parseText(
        aggregatedText,
        file.name,
        totalPages,
        ocrPagesUsed > 0 ? 'mixed' : 'native'
      );

      onProgress?.({
        currentPage: totalPages,
        totalPages,
        stage: 'complete',
        message: 'Procesamiento completado'
      });

      if (!parseResult.success || !parseResult.loanDraft) {
        telemetry.errors.push('Text parsing failed');
        telemetry.processingTimeMs = Math.round(performance.now() - startTime);
        this.logTelemetry(telemetry);
        
        return {
          success: false,
          errors: parseResult.errors,
          warnings: parseResult.warnings,
          pagesProcessed: totalPages,
          ocrPagesUsed,
          fieldsExtracted: [],
          fieldsMissing: ['all'], // All fields missing if parsing failed
          pendingFields: ['all'],
          telemetry
        };
      }

      // Check if we have minimum required fields (updated to use Pendiente pattern)
      const hasMinimumData = this.validateMinimumFields(parseResult.loanDraft);
      
      // Determine extracted and missing fields
      const fieldsExtracted: string[] = [];
      const fieldsMissing: string[] = [];
      
      const draft = parseResult.loanDraft;
      if (draft.prestamo.banco) fieldsExtracted.push('banco');
      else {
        fieldsMissing.push('banco');
        telemetry.pendingFieldReasons['banco'] = 'Entidad bancaria no detectada en el texto';
      }
      
      if (draft.prestamo.tipo) fieldsExtracted.push('tipo');
      else {
        fieldsMissing.push('tipo');
        telemetry.pendingFieldReasons['tipo'] = 'Tipo de interés no encontrado o ambiguo';
      }
      
      if (draft.prestamo.capitalInicial) fieldsExtracted.push('capitalInicial');
      else {
        fieldsMissing.push('capitalInicial');
        telemetry.pendingFieldReasons['capitalInicial'] = 'Capital inicial no detectado o formato inválido';
      }
      
      if (draft.prestamo.plazoMeses) fieldsExtracted.push('plazoMeses');
      else {
        fieldsMissing.push('plazoMeses');
        telemetry.pendingFieldReasons['plazoMeses'] = 'Plazo del préstamo no encontrado';
      }

      // Add additional field checks for comprehensive tracking
      if (draft.prestamo.tinFijo || draft.prestamo.diferencial) fieldsExtracted.push('tin');
      else {
        fieldsMissing.push('tin');
        telemetry.pendingFieldReasons['tin'] = 'TIN/TAE no detectado o formato inválido';
      }

      if (draft.prestamo.ibanCargoParcial) fieldsExtracted.push('cuentaCargo');
      else {
        fieldsMissing.push('cuentaCargo');
        telemetry.pendingFieldReasons['cuentaCargo'] = 'IBAN de cuenta de cargo no detectado';
      }

      // Calculate telemetry metrics
      telemetry.processingTimeMs = Math.round(performance.now() - startTime);
      telemetry.textToOcrRatio = totalPages > 0 ? Math.round(((totalPages - ocrPagesUsed) / totalPages) * 100) : 0;
      telemetry.confidence = parseResult.confidence || 0;

      // Log telemetry for audit
      this.logTelemetry(telemetry);
      
      return {
        success: true,
        loanDraft: parseResult.loanDraft,
        confidence: parseResult.confidence,
        errors: hasMinimumData.errors,
        warnings: [...parseResult.warnings, ...hasMinimumData.warnings],
        pagesProcessed: totalPages,
        ocrPagesUsed,
        fieldsExtracted,
        fieldsMissing,
        pendingFields: hasMinimumData.pendingFields,
        telemetry,
        data: parseResult.loanDraft // For compatibility
      };

    } catch (error) {
      console.error('[FEIN] Error processing FEIN document:', error);
      
      // Update telemetry with error information
      telemetry.errors.push(`Processing error: ${error}`);
      telemetry.processingTimeMs = Math.round(performance.now() - startTime);
      this.logTelemetry(telemetry);
      
      return {
        success: false,
        errors: ['No hemos podido procesar algunas páginas. Reinténtalo o crea el préstamo manualmente.'],
        warnings: [],
        pagesProcessed: 0,
        ocrPagesUsed: 0,
        fieldsExtracted: [],
        fieldsMissing: ['all'], // All fields missing on error
        pendingFields: ['all'],
        telemetry
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
   * Process a single page: extract text and determine if OCR is needed
   */
  private async processPage(
    pdf: pdfjsLib.PDFDocumentProxy, 
    pageNumber: number
  ): Promise<PageProcessingResult> {
    const page = await pdf.getPage(pageNumber);
    
    // Extract text content
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();

    // Determine if OCR is needed based on text ratio
    const hasNativeText = pageText.length >= this.MIN_TEXT_RATIO;
    const needsOCR = !hasNativeText;

    return {
      pageNumber,
      text: pageText,
      hasNativeText,
      needsOCR
    };
  }

  /**
   * Perform OCR on a scanned page
   */
  private async performPageOCR(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    pageResult: PageProcessingResult
  ): Promise<void> {
    try {
      const page = await pdf.getPage(pageNumber);
      
      // Render page to canvas
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      // Limit canvas size for performance
      const scale = Math.min(this.MAX_IMAGE_WIDTH / viewport.width, 2.0);
      const scaledViewport = page.getViewport({ scale });
      
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Render page
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
        canvas: canvas
      }).promise;

      // Convert to image and compress
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const imageBase64 = imageDataUrl.split(',')[1];

      // Call OCR endpoint
      const response = await fetch('/.netlify/functions/fein-ocr-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageImage: imageBase64,
          pageNumber
        })
      });

      if (!response.ok) {
        throw new Error(`OCR request failed: ${response.status}`);
      }

      const ocrResult = await response.json();
      
      if (ocrResult.success && ocrResult.text) {
        pageResult.ocrResult = ocrResult.text;
        pageResult.text = ocrResult.text; // Replace with OCR text
        console.log(`[FEIN] OCR successful for page ${pageNumber}: ${ocrResult.text.length} chars`);
      } else {
        throw new Error(ocrResult.error || 'OCR failed');
      }

    } catch (error) {
      console.warn(`[FEIN] OCR failed for page ${pageNumber}:`, error);
      pageResult.error = `OCR falló para página ${pageNumber}`;
    }
  }

  /**
   * Aggregate text from all pages
   */
  private aggregatePageText(pageResults: PageProcessingResult[]): string {
    return pageResults
      .map(result => result.text)
      .filter(text => text && text.length > 10) // Filter out empty/minimal text
      .join('\n\n')
      .trim();
  }

  /**
   * Validate minimum required fields for loan creation
   * Updated to use "Pendiente" UX pattern - no hard errors, only warnings
   */
  private validateMinimumFields(draft: FeinLoanDraft): { errors: string[]; warnings: string[]; pendingFields: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const pendingFields: string[] = [];

    // Track missing critical fields as "Pendiente" instead of errors
    if (!draft.prestamo.banco) {
      warnings.push('Entidad bancaria marcada como Pendiente para completar manualmente');
      pendingFields.push('banco');
    }

    if (!draft.prestamo.capitalInicial) {
      warnings.push('Capital inicial marcado como Pendiente para completar manualmente');
      pendingFields.push('capitalInicial');
    }

    if (!draft.prestamo.tipo) {
      warnings.push('Tipo de interés marcado como Pendiente para completar manualmente');
      pendingFields.push('tipo');
    }

    if (!draft.prestamo.plazoMeses) {
      warnings.push('Plazo del préstamo marcado como Pendiente para completar manualmente');
      pendingFields.push('plazoMeses');
    }

    // Additional fields that are nice to have but not critical
    if (!draft.prestamo.tinFijo && !draft.prestamo.diferencial) {
      warnings.push('TIN/TAE marcado como Pendiente para completar manualmente');
      pendingFields.push('tin');
    }

    if (!draft.prestamo.ibanCargoParcial) {
      warnings.push('Cuenta de cargo marcada como Pendiente para completar manualmente');
      pendingFields.push('cuentaCargo');
    }

    // No hard errors - always allow creating draft with pending fields
    return { errors, warnings, pendingFields };
  }

  // Legacy methods for backward compatibility (deprecated)
  async processFEINDocumentChunked(file: File): Promise<any> {
    console.warn('[FEIN] Using deprecated chunked method - redirecting to new implementation');
    const result = await this.processFEINDocument(file);
    
    return {
      success: result.success,
      jobId: 'legacy-' + Date.now(),
      pagesTotal: result.pagesProcessed,
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