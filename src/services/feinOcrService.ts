// FEIN OCR Service - Rewritten for "texto-primero, OCR-después" pattern
// Implements client-side PDF text extraction with page-by-page OCR for scanned pages
// Following problem statement requirements to avoid ResponseSizeTooLarge errors

import * as pdfjsLib from 'pdfjs-dist';
import { FeinLoanDraft } from '../types/fein';
import { FeinTextParser } from './fein/parseFeinText';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  data?: any; // For compatibility with existing code
}

export class FEINOCRService {
  private static instance: FEINOCRService;
  
  // Constants following problem statement requirements
  private readonly MIN_TEXT_RATIO = 200; // Minimum characters per page to skip OCR
  private readonly MAX_CONCURRENT_OCR = 2; // Limit concurrent OCR requests
  private readonly MAX_IMAGE_WIDTH = 1600; // Max image width for OCR
  private readonly MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB max PDF size
  
  static getInstance(): FEINOCRService {
    if (!FEINOCRService.instance) {
      FEINOCRService.instance = new FEINOCRService();
    }
    return FEINOCRService.instance;
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
    console.log('[FEIN] Starting text-first, OCR-after processing:', file.name);
    
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          errors: [validation.error!],
          warnings: [],
          pagesProcessed: 0,
          ocrPagesUsed: 0,
          fieldsExtracted: [],
          fieldsMissing: ['all'] // All fields missing if file is invalid
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

      console.log(`[FEIN] PDF loaded: ${totalPages} pages`);

      // Process each page: extract text first, OCR if needed
      const pageResults: PageProcessingResult[] = [];
      let ocrPagesUsed = 0;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
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
            
            onProgress?.({
              currentPage: pageNum,
              totalPages,
              stage: 'ocr',
              message: `Aplicando OCR a página ${pageNum} (imagen escaneada)...`
            });

            // Perform OCR on this page
            await this.performPageOCR(pdf, pageNum, pageResult);
          }

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
        return {
          success: false,
          errors: ['No se pudo extraer suficiente texto del documento FEIN'],
          warnings: [],
          pagesProcessed: totalPages,
          ocrPagesUsed,
          fieldsExtracted: [],
          fieldsMissing: ['all'] // All fields missing if no text extracted
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
        return {
          success: false,
          errors: parseResult.errors,
          warnings: parseResult.warnings,
          pagesProcessed: totalPages,
          ocrPagesUsed,
          fieldsExtracted: [],
          fieldsMissing: ['all'] // All fields missing if parsing failed
        };
      }

      // Check if we have minimum required fields
      const hasMinimumData = this.validateMinimumFields(parseResult.loanDraft);
      
      // Determine extracted and missing fields
      const fieldsExtracted: string[] = [];
      const fieldsMissing: string[] = [];
      
      const draft = parseResult.loanDraft;
      if (draft.prestamo.banco) fieldsExtracted.push('banco');
      else fieldsMissing.push('banco');
      
      if (draft.prestamo.tipo) fieldsExtracted.push('tipo');
      else fieldsMissing.push('tipo');
      
      if (draft.prestamo.capitalInicial) fieldsExtracted.push('capitalInicial');
      else fieldsMissing.push('capitalInicial');
      
      if (draft.prestamo.plazoMeses) fieldsExtracted.push('plazoMeses');
      else fieldsMissing.push('plazoMeses');
      
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
        data: parseResult.loanDraft // For compatibility
      };

    } catch (error) {
      console.error('[FEIN] Error processing FEIN document:', error);
      return {
        success: false,
        errors: ['Error interno procesando el documento FEIN'],
        warnings: [],
        pagesProcessed: 0,
        ocrPagesUsed: 0,
        fieldsExtracted: [],
        fieldsMissing: ['all'] // All fields missing on error
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
   */
  private validateMinimumFields(draft: FeinLoanDraft): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Critical fields
    if (!draft.prestamo.banco) {
      warnings.push('No se pudo identificar la entidad bancaria');
    }

    if (!draft.prestamo.capitalInicial) {
      errors.push('No se pudo extraer el capital del préstamo');
    }

    if (!draft.prestamo.tipo) {
      warnings.push('No se pudo determinar el tipo de interés');
    }

    if (!draft.prestamo.plazoMeses) {
      warnings.push('No se pudo extraer el plazo del préstamo');
    }

    // Validate minimum data for loan creation
    const hasMinimumForCreation = draft.prestamo.capitalInicial && 
                                 draft.prestamo.plazoMeses && 
                                 draft.prestamo.tipo;

    if (!hasMinimumForCreation) {
      errors.push('Datos insuficientes para crear el préstamo automáticamente');
    }

    return { errors, warnings };
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