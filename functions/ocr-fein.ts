// FEIN OCR Endpoint - Chunk-based processing to avoid ResponseSizeTooLarge
// Implements PDF partitioning, server-side aggregation, and compact JSON response

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { FeinLoanDraft, ChunkProcessingResult } from '../src/types/fein';
import { FeinNormalizer } from '../src/services/ocr/feinNormalizer';
import { OCR_CONFIG } from '../src/config/ocr.config';

// In-memory job store (for demo - in production use Redis/DB)
const jobStore = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: { pagesTotal: number; pagesProcessed: number; currentChunk?: number; totalChunks?: number };
  result?: FeinLoanDraft;
  error?: string;
  createdAt: string;
  updatedAt: string;
}>();

// Helper to generate job ID
const generateJobId = (): string => `fein_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Helper to extract file from multipart or binary request
const extractFileFromRequest = (event: HandlerEvent): { content: string; mimeType: string; filename?: string } | null => {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  
  if (!contentType.includes('application/octet-stream')) {
    return null;
  }

  let fileBase64: string;
  
  // Handle base64 encoding based on event.isBase64Encoded
  if (event.isBase64Encoded === true) {
    fileBase64 = event.body || '';
  } else {
    if (!event.body) return null;
    fileBase64 = Buffer.from(event.body, 'binary').toString('base64');
  }

  return {
    content: fileBase64,
    mimeType: 'application/pdf',
    filename: 'fein.pdf'
  };
};

// Simulate PDF page extraction (in production, use PDF.js or similar)
const extractPdfPages = async (fileBase64: string): Promise<{ totalPages: number; pageImages: string[] }> => {
  // Simulate page count based on file size
  const fileSizeBytes = (fileBase64.length * 3) / 4;
  const estimatedPages = Math.ceil(fileSizeBytes / (OCR_CONFIG.estimatedKbPerPage * 1024));
  
  // For demo purposes, simulate page extraction
  // In production: use PDF.js to extract individual pages as images
  const pageImages: string[] = [];
  for (let i = 0; i < estimatedPages; i++) {
    // Simulate individual page content (would be actual page images)
    pageImages.push(fileBase64); // In real implementation, this would be the individual page
  }
  
  return {
    totalPages: estimatedPages,
    pageImages
  };
};

// Process a single chunk of pages
const processChunk = async (
  pageImages: string[],
  chunkIndex: number,
  pageRange: { from: number; to: number }
): Promise<ChunkProcessingResult> => {
  const startTime = Date.now();
  let retryCount = 0;
  let lastError: string | undefined;

  while (retryCount <= OCR_CONFIG.maxRetriesPerChunk) {
    try {
      // Simulate chunk processing delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      // In production: combine page images into a small PDF/image for OCR
      // For now, simulate OCR response
      const mockOcrText = generateMockFeinText(chunkIndex, pageRange);
      
      // Extract data from this chunk
      const extractionResult = FeinNormalizer.extractFromChunk(mockOcrText, chunkIndex, pageRange);
      
      // Calculate processing time
      const processingTimeMs = Date.now() - startTime;
      
      return {
        chunkIndex,
        pageRange,
        extractedData: extractionResult,
        bonificaciones: extractionResult.bonificaciones || [],
        confidence: 0.85 + Math.random() * 0.1, // Simulate confidence
        processingTimeMs,
        retryCount
      };

    } catch (error) {
      retryCount++;
      lastError = error instanceof Error ? error.message : 'Error desconocido';
      
      if (retryCount <= OCR_CONFIG.maxRetriesPerChunk) {
        // Exponential backoff
        const backoffMs = OCR_CONFIG.retryBackoffMs * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  return {
    chunkIndex,
    pageRange,
    extractedData: {},
    bonificaciones: [],
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
    retryCount,
    error: lastError || 'Error procesando chunk tras múltiples reintentos'
  };
};

// Generate mock FEIN text for testing (remove in production)
const generateMockFeinText = (chunkIndex: number, pageRange: { from: number; to: number }): string => {
  const mockTexts = [
    `FICHA EUROPEA DE INFORMACIÓN NORMALIZADA (FEIN)
    Banco Santander S.A.
    Préstamo hipotecario vivienda habitual
    Capital: 250.000,00 €
    Plazo: 25 años
    Tipo de interés: VARIABLE
    Índice de referencia: EURIBOR 12 meses
    Diferencial: +1,50%
    Revisión: Anual`,
    
    `CONDICIONES FINANCIERAS
    TIN: 3,45% anual
    TAE: 3,68% anual
    Comisión apertura: 0,50%
    Comisión mantenimiento: 0 €/mes
    Sistema amortización: Francés
    Cuota mensual aproximada: 1.263,45 €`,
    
    `BONIFICACIONES DISPONIBLES
    - Domiciliación nómina: -0,10 puntos
    - Domiciliación recibos: -0,05 puntos  
    - Seguro hogar: -0,15 puntos
    - Tarjeta débito: -0,05 puntos
    Cuenta cargo: ES12 0049 **** **** 1234`,
    
    `INFORMACIÓN ADICIONAL
    Fecha primera cuota: 01/02/2024
    Próxima revisión: 01/01/2025
    Amortización anticipada: Sin comisión
    Subrogación: 0,15% mínimo 300 €`
  ];
  
  return mockTexts[chunkIndex % mockTexts.length] || mockTexts[0];
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.info('FEIN OCR Request', { 
    method: event.httpMethod, 
    path: event.path,
    queryParams: event.queryStringParameters 
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Handle job status check (GET /.netlify/functions/ocr-fein?jobId=xxx)
  if (event.httpMethod === 'GET') {
    const jobId = event.queryStringParameters?.jobId;
    
    if (!jobId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'jobId requerido'
        })
      };
    }

    const job = jobStore.get(jobId);
    if (!job) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Job no encontrado'
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        job: {
          jobId,
          ...job
        }
      })
    };
  }

  // Handle FEIN processing start (POST)
  if (event.httpMethod === 'POST') {
    try {
      // Extract file from request
      const fileData = extractFileFromRequest(event);
      if (!fileData) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'Archivo PDF requerido (Content-Type: application/octet-stream)'
          })
        };
      }

      // Validate file size
      const fileSizeBytes = (fileData.content.length * 3) / 4;
      if (fileSizeBytes > OCR_CONFIG.maxPdfSizeBytes) {
        return {
          statusCode: 413,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: `Archivo demasiado grande. Máximo ${OCR_CONFIG.maxPdfSizeBytes / (1024 * 1024)}MB`
          })
        };
      }

      // Create job
      const jobId = generateJobId();
      const now = new Date().toISOString();
      
      // Extract PDF pages
      const { totalPages, pageImages } = await extractPdfPages(fileData.content);
      
      // Calculate chunks
      const totalChunks = Math.ceil(totalPages / OCR_CONFIG.pagesPerChunk);
      
      // Initialize job
      jobStore.set(jobId, {
        status: 'processing',
        progress: {
          pagesTotal: totalPages,
          pagesProcessed: 0,
          currentChunk: 0,
          totalChunks
        },
        createdAt: now,
        updatedAt: now
      });

      // Process chunks asynchronously (don't await - return job immediately)
      processChunksAsync(jobId, pageImages, totalPages, fileData.filename || 'fein.pdf');

      // Return job info immediately
      return {
        statusCode: 202,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          jobId,
          pagesTotal: totalPages,
          totalChunks,
          message: 'Procesamiento iniciado. Use GET con jobId para seguir el progreso.'
        })
      };

    } catch (error) {
      console.error('FEIN OCR Error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Error interno del servidor'
        })
      };
    }
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({
      success: false,
      error: 'Método no permitido'
    })
  };
};

// Async chunk processing (runs in background)
const processChunksAsync = async (
  jobId: string,
  pageImages: string[],
  totalPages: number,
  filename: string
): Promise<void> => {
  const job = jobStore.get(jobId);
  if (!job) return;

  try {
    const chunks: ChunkProcessingResult[] = [];
    const totalChunks = Math.ceil(totalPages / OCR_CONFIG.pagesPerChunk);

    // Process chunks with concurrency limit
    for (let i = 0; i < totalChunks; i += OCR_CONFIG.maxConcurrentChunks) {
      const chunkPromises: Promise<ChunkProcessingResult>[] = [];
      
      for (let j = 0; j < OCR_CONFIG.maxConcurrentChunks && (i + j) < totalChunks; j++) {
        const chunkIndex = i + j;
        const startPage = chunkIndex * OCR_CONFIG.pagesPerChunk + 1;
        const endPage = Math.min((chunkIndex + 1) * OCR_CONFIG.pagesPerChunk, totalPages);
        
        const pageRange = { from: startPage, to: endPage };
        const chunkPageImages = pageImages.slice(startPage - 1, endPage);
        
        chunkPromises.push(processChunk(chunkPageImages, chunkIndex, pageRange));
      }

      // Wait for this batch of chunks
      const batchResults = await Promise.all(chunkPromises);
      chunks.push(...batchResults);

      // Update progress
      const pagesProcessed = chunks.reduce((sum, chunk) => 
        sum + (chunk.pageRange.to - chunk.pageRange.from + 1), 0);
      
      job.progress.pagesProcessed = pagesProcessed;
      job.progress.currentChunk = chunks.length;
      job.updatedAt = new Date().toISOString();
      jobStore.set(jobId, job);
    }

    // Aggregate results
    const aggregated = FeinNormalizer.aggregateChunks(chunks, filename, totalPages, 'google');
    const compacted = FeinNormalizer.compactResponse(aggregated);

    // Update job with final result
    job.status = 'completed';
    job.result = compacted;
    job.updatedAt = new Date().toISOString();
    jobStore.set(jobId, job);

    console.info('FEIN processing completed', { 
      jobId, 
      totalPages, 
      chunksProcessed: chunks.length,
      finalSizeBytes: JSON.stringify(compacted).length
    });

  } catch (error) {
    console.error('FEIN processing failed', { jobId, error });
    
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Error desconocido';
    job.updatedAt = new Date().toISOString();
    jobStore.set(jobId, job);
  }
};

// Cleanup old jobs (run periodically)
setInterval(() => {
  const now = Date.now();
  const ttlMs = OCR_CONFIG.tempStoreTtlMinutes * 60 * 1000;
  
  for (const [jobId, job] of jobStore.entries()) {
    const jobAge = now - new Date(job.createdAt).getTime();
    if (jobAge > ttlMs) {
      jobStore.delete(jobId);
    }
  }
}, 60000); // Clean up every minute