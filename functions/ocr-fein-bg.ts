// FEIN OCR Background Function - Handles long-running PDF processing
// Implements chunking, DocAI calls, aggregation and job status persistence

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PDFDocument } from 'pdf-lib';
import { normalizeFeinFromDocAI } from '../src/services/ocr/normalize-docai';

// Interfaces for job management
interface FeinBackgroundJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    success: boolean;
    providerUsed: string;
    docId: string;
    fields: any;
    confidenceGlobal: number;
    pending: string[];
  };
  error?: string;
  startedAt: string;
  completedAt?: string;
  metadata?: {
    totalPages: number;
    chunks: number;
    processingTimeMs?: number;
  };
}

// Constants
const MAX_PAGES_TOTAL = 60;
const PAGES_PER_CHUNK = 15;
const MAX_CONCURRENT_CHUNKS = 2;

// Helper to generate document ID
const generateDocId = (): string => `fein_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Job storage using Netlify Blobs (simplified implementation using environment for demo)
// In production, you would use Netlify Blobs, KV store, or database
const setJobStatus = async (jobId: string, job: FeinBackgroundJob): Promise<void> => {
  // For demo purposes, we'll use a simple in-memory store
  // In production, use Netlify Blobs:
  // const { store } = await getStore({ name: 'fein-jobs', siteID: process.env.SITE_ID });
  // await store.set(jobId, JSON.stringify(job));
  console.info(`[BG] Job ${jobId} status:`, job.status);
};

const getJobStatus = async (jobId: string): Promise<FeinBackgroundJob | null> => {
  // For demo purposes, return null (not found)
  // In production, retrieve from Netlify Blobs:
  // const { store } = await getStore({ name: 'fein-jobs', siteID: process.env.SITE_ID });
  // const jobData = await store.get(jobId);
  // return jobData ? JSON.parse(jobData) : null;
  return null;
};

// Split PDF into chunks of maximum pages
const splitPdfIntoChunks = async (pdfBytes: Uint8Array, maxPagesPerChunk: number = PAGES_PER_CHUNK): Promise<Uint8Array[]> => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const chunks: Uint8Array[] = [];

  console.info(`[BG] Splitting PDF: ${totalPages} pages into chunks of ${maxPagesPerChunk}`);

  for (let i = 0; i < totalPages; i += maxPagesPerChunk) {
    const endPage = Math.min(i + maxPagesPerChunk, totalPages);
    
    // Create new PDF for this chunk
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
    
    const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => chunkDoc.addPage(page));
    
    const chunkBytes = await chunkDoc.save();
    chunks.push(chunkBytes);
    
    console.info(`[BG] Created chunk ${chunks.length}: pages ${i + 1}-${endPage}`);
  }

  return chunks;
};

// Process single chunk with DocAI
const processChunkWithDocAI = async (chunkBytes: Uint8Array, chunkIndex: number): Promise<any> => {
  const startTime = Date.now();
  
  try {
    // Convert to base64 for DocAI call
    const base64Content = Buffer.from(chunkBytes).toString('base64');
    
    // Call ocr-documentai endpoint
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
    let docaiEndpoint: string;
    
    if (siteUrl) {
      docaiEndpoint = new URL('/.netlify/functions/ocr-documentai', siteUrl).toString();
    } else {
      docaiEndpoint = '/.netlify/functions/ocr-documentai';
    }

    const response = await fetch(docaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf'
      },
      body: chunkBytes
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunk ${chunkIndex + 1} failed: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;
    
    console.info(`[BG] Chunk ${chunkIndex + 1} processed in ${processingTime}ms`);
    
    return {
      ...result,
      chunkIndex,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[BG] Chunk ${chunkIndex + 1} failed after ${processingTime}ms:`, error);
    throw error;
  }
};

// Aggregate results from multiple chunks
const aggregateChunkResults = (chunkResults: any[], totalPages: number): any => {
  console.info(`[BG] Aggregating ${chunkResults.length} chunk results`);
  
  const aggregatedEntities: any[] = [];
  let aggregatedText = '';
  
  chunkResults.forEach((chunkResult, chunkIndex) => {
    if (!chunkResult.success || !chunkResult.results || chunkResult.results.length === 0) {
      console.warn(`[BG] Chunk ${chunkIndex + 1} has no valid results`);
      return;
    }

    const result = chunkResult.results[0];
    const pageOffset = chunkIndex * PAGES_PER_CHUNK;
    
    // Add entities with corrected page numbers
    if (result.entities) {
      result.entities.forEach((entity: any) => {
        const correctedEntity = { ...entity };
        
        // Correct page references
        if (entity.pageAnchor?.pageRefs) {
          correctedEntity.pageAnchor = {
            ...entity.pageAnchor,
            pageRefs: entity.pageAnchor.pageRefs.map((ref: any) => ({
              ...ref,
              page: ref.page + pageOffset
            }))
          };
        }
        
        aggregatedEntities.push(correctedEntity);
      });
    }
    
    // Concatenate text
    if (result.text) {
      aggregatedText += result.text + '\n';
    }
  });

  console.info(`[BG] Aggregated ${aggregatedEntities.length} entities from ${chunkResults.length} chunks`);

  return {
    success: true,
    results: [{
      status: 'success',
      entities: aggregatedEntities,
      text: aggregatedText.trim()
    }]
  };
};

// Main background processing function
const processDocumentInBackground = async (jobId: string, pdfBytes: Uint8Array): Promise<void> => {
  const docId = generateDocId();
  const startTime = Date.now();
  
  try {
    // Update job status to processing
    await setJobStatus(jobId, {
      jobId,
      status: 'processing',
      startedAt: new Date().toISOString(),
      metadata: { totalPages: 0, chunks: 0 }
    });

    // Load PDF and get page count
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    
    console.info(`[BG] Processing PDF: ${totalPages} pages, jobId: ${jobId}`);

    // Check page limit
    if (totalPages > MAX_PAGES_TOTAL) {
      await setJobStatus(jobId, {
        jobId,
        status: 'failed',
        error: `PDF demasiado largo (${totalPages} págs). Máximo permitido: ${MAX_PAGES_TOTAL} páginas`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });
      return;
    }

    // Split into chunks
    const chunks = await splitPdfIntoChunks(pdfBytes, PAGES_PER_CHUNK);
    
    // Update job with metadata
    await setJobStatus(jobId, {
      jobId,
      status: 'processing',
      startedAt: new Date().toISOString(),
      metadata: { totalPages, chunks: chunks.length }
    });

    // Process chunks with controlled concurrency
    const chunkResults: any[] = [];
    
    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
      const batchChunks = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
      const batchPromises = batchChunks.map((chunk, batchIndex) => 
        processChunkWithDocAI(chunk, i + batchIndex)
      );
      
      const batchResults = await Promise.all(batchPromises);
      chunkResults.push(...batchResults);
    }

    // Check if any chunk failed
    const failedChunk = chunkResults.find(result => !result.success);
    if (failedChunk) {
      await setJobStatus(jobId, {
        jobId,
        status: 'failed',
        error: `Error procesando el documento (chunk ${failedChunk.chunkIndex + 1})`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: { totalPages, chunks: chunks.length }
      });
      return;
    }

    // Aggregate results
    const aggregatedResult = aggregateChunkResults(chunkResults, totalPages);
    
    // Extract entities and text from aggregated result
    const ocrResult = aggregatedResult.results[0];
    
    // Normalize FEIN data from DocAI entities
    const normalizedResult = normalizeFeinFromDocAI({
      entities: ocrResult.entities || [],
      text: ocrResult.text || ''
    });

    const processingTime = Date.now() - startTime;
    
    // Complete job
    await setJobStatus(jobId, {
      jobId,
      status: 'completed',
      result: {
        success: true,
        providerUsed: 'docai',
        docId,
        fields: normalizedResult?.fields || {},
        confidenceGlobal: normalizedResult?.confidenceGlobal || 0,
        pending: normalizedResult?.pending || []
      },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      metadata: { 
        totalPages, 
        chunks: chunks.length,
        processingTimeMs: processingTime
      }
    });

    console.info(`[BG] Job ${jobId} completed in ${processingTime}ms`);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[BG] Job ${jobId} failed after ${processingTime}ms:`, error);
    
    await setJobStatus(jobId, {
      jobId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Error interno procesando documento',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      metadata: { totalPages: 0, chunks: 0, processingTimeMs: processingTime }
    });
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Main handler for background function
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.info('[BG] FEIN Background Request', { 
    method: event.httpMethod, 
    path: event.path 
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Método no permitido'
      })
    };
  }

  try {
    // Extract job data from request body
    const requestData = JSON.parse(event.body || '{}');
    const { jobId, pdfBase64 } = requestData;

    if (!jobId || !pdfBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'jobId y pdfBase64 requeridos'
        })
      };
    }

    // Convert base64 to bytes
    const pdfBytes = Uint8Array.from(Buffer.from(pdfBase64, 'base64'));

    // Start background processing (fire and forget)
    processDocumentInBackground(jobId, pdfBytes).catch(error => {
      console.error(`[BG] Background processing failed for job ${jobId}:`, error);
    });

    // Return immediate response
    return {
      statusCode: 202,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Procesamiento iniciado en segundo plano',
        jobId
      })
    };

  } catch (error) {
    console.error('[BG] Background function error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor'
      })
    };
  }
};