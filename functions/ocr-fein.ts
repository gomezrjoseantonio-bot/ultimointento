// FEIN OCR Endpoint - DocAI processing with chunking + timeout with background fallback
// Implements PDF splitting in ≤15-page chunks with 8s sync timeout and background processing

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PDFDocument } from 'pdf-lib';
import { normalizeFeinFromDocAI } from '../src/services/ocr/normalize-docai';
import { processWithDocAI } from '../src/services/documentaiClient';
import { OCR_CONFIG } from '../src/config/ocr.config';
import { getStore } from '@netlify/blobs';

// Constants for chunking and processing
const MAX_PAGES_TOTAL = 60; // Hard cap: >60 pages = 413 error
const PAGES_PER_CHUNK = 15; // Maximum pages per DocAI request
const SYNC_TIMEOUT_MS = 8000; // 8 second timeout for sync processing
const MAX_CONCURRENT_CHUNKS = 2; // Concurrency limit for chunk processing
const BACKGROUND_THRESHOLD_PAGES = 15; // Auto-background if >15 pages
const BACKGROUND_THRESHOLD_KB = 8192; // Auto-background if >8MB

// Interfaces for job management
interface FeinBackgroundJob {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: { 
    percent: number; 
    pageCurrent?: number; 
    pagesTotal?: number; 
  };
  result?: {
    providerUsed: string;
    fields: any;
    pending: string[];
    confidenceGlobal: number;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper to generate document ID
const generateDocId = (): string => `fein_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Helper to generate job ID
const generateJobId = (): string => `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Netlify Blobs storage helpers
const BUCKET = 'fein-jobs';
const jobKey = (id: string) => `job:${id}`;

const putJob = async (id: string, data: FeinBackgroundJob): Promise<void> => {
  try {
    const store = getStore(BUCKET);
    await store.set(jobKey(id), JSON.stringify(data));
    console.info('[FEIN] job', { jobId: id, status: data.status, percent: data.progress?.percent });
  } catch (error) {
    console.error('Error saving job to blobs:', error);
    throw error;
  }
};

const getJob = async (id: string): Promise<FeinBackgroundJob | null> => {
  try {
    const store = getStore(BUCKET);
    const jobData = await store.get(jobKey(id));
    return jobData ? JSON.parse(jobData) : null;
  } catch (error) {
    console.error('Error retrieving job from blobs:', error);
    return null;
  }
};

// Job storage functions (using Netlify Blobs)
const setJobStatus = async (jobId: string, job: FeinBackgroundJob): Promise<void> => {
  await putJob(jobId, job);
};

const getJobStatus = async (jobId: string): Promise<FeinBackgroundJob | null> => {
  return await getJob(jobId);
};

// Count PDF pages
const countPdfPages = async (pdfBytes: Uint8Array): Promise<number> => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    throw new Error('Error analizando PDF');
  }
};

// Split PDF into chunks of maximum pages
const splitPdfIntoChunks = async (pdfBytes: Uint8Array, maxPagesPerChunk: number = PAGES_PER_CHUNK): Promise<Uint8Array[]> => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const chunks: Uint8Array[] = [];

  console.info(`Splitting PDF: ${totalPages} pages into chunks of ${maxPagesPerChunk}`);

  for (let i = 0; i < totalPages; i += maxPagesPerChunk) {
    const endPage = Math.min(i + maxPagesPerChunk, totalPages);
    
    // Create new PDF for this chunk
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
    
    const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => chunkDoc.addPage(page));
    
    const chunkBytes = await chunkDoc.save();
    chunks.push(chunkBytes);
    
    console.info(`Created chunk ${chunks.length}: pages ${i + 1}-${endPage}`);
  }

  return chunks;
};

// Process single chunk with DocAI
const processChunkWithDocAI = async (chunkBytes: Uint8Array, chunkIndex: number): Promise<any> => {
  const startTime = Date.now();
  
  try {
    const response = await fetch(getDocAIEndpoint(), {
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
    
    if (process.env.NODE_ENV !== 'production') {
      console.info(`Chunk ${chunkIndex + 1} processed`, { 
        index: chunkIndex + 1, 
        pagesInChunk: Math.min(PAGES_PER_CHUNK, result.meta?.totalPages || PAGES_PER_CHUNK),
        ms: processingTime, 
        status: result.success ? 'success' : 'error'
      });
    }
    
    return {
      ...result,
      chunkIndex,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`Chunk ${chunkIndex + 1} failed after ${processingTime}ms:`, error);
    throw error;
  }
};

// Aggregate results from multiple chunks
const aggregateChunkResults = (chunkResults: any[], totalPages: number): any => {
  console.info(`Aggregating ${chunkResults.length} chunk results`);
  
  const aggregatedEntities: any[] = [];
  let aggregatedText = '';
  
  chunkResults.forEach((chunkResult, chunkIndex) => {
    if (!chunkResult.success || !chunkResult.results || chunkResult.results.length === 0) {
      console.warn(`Chunk ${chunkIndex + 1} has no valid results`);
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

  console.info(`Aggregated ${aggregatedEntities.length} entities from ${chunkResults.length} chunks`);

  return {
    success: true,
    results: [{
      status: 'success',
      entities: aggregatedEntities,
      text: aggregatedText.trim()
    }]
  };
};

// Get DocAI endpoint URL
const getDocAIEndpoint = (): string => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  
  if (siteUrl) {
    return new URL('/.netlify/functions/ocr-documentai', siteUrl).toString();
  } else {
    return '/.netlify/functions/ocr-documentai';
  }
};

// Call background function
const callBackgroundFunction = async (jobId: string, pdfBase64: string): Promise<void> => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
    let bgEndpoint: string;
    
    if (siteUrl) {
      bgEndpoint = new URL('/.netlify/functions/ocr-fein-bg', siteUrl).toString();
    } else {
      bgEndpoint = '/.netlify/functions/ocr-fein-bg';
    }

    const response = await fetch(bgEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jobId, pdfBase64 })
    });

    if (!response.ok) {
      console.error('Background function call failed:', response.status);
    }
  } catch (error) {
    console.error('Error calling background function:', error);
  }
};

// Extract file from request
const extractFileFromRequest = (event: HandlerEvent): { content: string; mimeType: string; sizeKB: number; filename?: string } | null => {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  
  // Accept multipart/form-data, application/pdf and application/octet-stream
  const isValidContentType = contentType.includes('multipart/form-data') ||
                            contentType.includes('application/pdf') || 
                            contentType.includes('application/octet-stream') ||
                            contentType === '';

  if (!isValidContentType) {
    return null;
  }

  if (!event.body) {
    return null;
  }

  let fileBase64: string;
  let detectedMime = 'application/pdf'; // Default
  let filename: string | undefined;

  // Handle multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    try {
      // Extract boundary from content-type header
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      if (!boundaryMatch) {
        console.warn('No boundary found in multipart/form-data');
        return null;
      }
      
      const boundary = boundaryMatch[1];
      
      // Convert event body to Buffer
      let bodyBuffer: Buffer;
      if (event.isBase64Encoded === true) {
        bodyBuffer = Buffer.from(event.body, 'base64');
      } else {
        bodyBuffer = Buffer.from(event.body, 'binary');
      }
      
      // Split by boundary
      const boundaryBytes = Buffer.from(`--${boundary}`);
      const parts = [];
      let currentIndex = 0;
      
      while (currentIndex < bodyBuffer.length) {
        const nextBoundary = bodyBuffer.indexOf(boundaryBytes, currentIndex);
        if (nextBoundary === -1) break;
        
        if (currentIndex > 0) {
          // Extract part content (skip the boundary itself)
          const partStart = currentIndex;
          const partEnd = nextBoundary;
          parts.push(bodyBuffer.slice(partStart, partEnd));
        }
        
        currentIndex = nextBoundary + boundaryBytes.length;
      }
      
      // Find the part with name="file" and/or Content-Type: application/pdf
      let fileBuffer: Buffer | null = null;
      
      for (const part of parts) {
        const partStr = part.toString('binary');
        
        // Look for Content-Disposition header with name="file"
        const contentDispositionMatch = partStr.match(/Content-Disposition:\s*form-data[^;]*;\s*name="file"/i);
        const contentTypeMatch = partStr.match(/Content-Type:\s*application\/pdf/i);
        const filenameMatch = partStr.match(/filename="([^"]+)"/i);
        
        if (contentDispositionMatch || contentTypeMatch) {
          // Find the double newline that separates headers from content
          const headerEndIndex = partStr.indexOf('\r\n\r\n');
          if (headerEndIndex === -1) continue;
          
          // Extract the file content (after headers)
          const contentStartIndex = headerEndIndex + 4; // Skip \r\n\r\n
          fileBuffer = part.slice(contentStartIndex);
          
          // Extract filename if present
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
          
          break;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        console.warn('No file content found in multipart/form-data');
        return null;
      }
      
      // Convert to base64
      fileBase64 = fileBuffer.toString('base64');
      detectedMime = 'application/pdf';
      
    } catch (error) {
      console.error('Error parsing multipart/form-data:', error);
      return null;
    }
  } else {
    // Handle application/pdf and application/octet-stream (existing logic)
    if (event.isBase64Encoded === true) {
      fileBase64 = event.body;
    } else {
      fileBase64 = Buffer.from(event.body, 'binary').toString('base64');
    }

    // Set MIME type based on content-type
    if (contentType.includes('application/pdf')) {
      detectedMime = 'application/pdf';
    } else if (contentType.includes('application/octet-stream') || contentType === '') {
      // Pass as binary and let ocr-documentai handle MIME detection
      detectedMime = 'application/pdf'; // Default to PDF for FEIN processing
    }

    // Extract filename from custom header if provided
    filename = event.headers['x-file-name'] || event.headers['X-File-Name'];
  }

  // Validate that we have content
  if (!fileBase64) {
    return null;
  }

  // Calculate file size
  const fileSizeBytes = (fileBase64.length * 3) / 4;
  const sizeKB = Math.round(fileSizeBytes / 1024);

  // Safe logging (no sensitive data)
  console.info('OCR Upload', { mimeType: detectedMime, sizeKB });

  return {
    content: fileBase64,
    mimeType: detectedMime,
    sizeKB,
    filename
  };
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-File-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();
  
  console.info('FEIN OCR Request', { 
    method: event.httpMethod, 
    path: event.path,
    query: event.queryStringParameters
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Handle GET requests for job status polling
  if (event.httpMethod === 'GET') {
    const jobId = event.queryStringParameters?.jobId;
    
    if (!jobId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'jobId parameter required'
        })
      };
    }

    try {
      const job = await getJobStatus(jobId);
      
      if (!job) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Job no encontrado'
          })
        };
      }

      // Return job status with consistent shape per requirements
      const response: any = {
        success: true,
        status: job.status,
        progress: job.progress
      };

      if (job.status === 'completed' && job.result) {
        response.result = job.result;
      } else if (job.status === 'failed' && job.error) {
        response.message = job.error;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(response)
      };

    } catch (error) {
      console.error('Error getting job status:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Error retrieving job status'
        })
      };
    }
  }

  // Only accept POST requests for processing
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
    // Extract file from request
    const fileData = extractFileFromRequest(event);
    if (!fileData) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Archivo no recibido'
        })
      };
    }

    // Validate file size using OCR_CONFIG limit
    const fileSizeBytes = (fileData.content.length * 3) / 4;
    if (fileSizeBytes > OCR_CONFIG.maxPdfSizeBytes) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: `Archivo demasiado grande (máx. ${OCR_CONFIG.maxPdfSizeBytes / (1024 * 1024)} MB)`
        })
      };
    }

    // Convert to PDF bytes for analysis
    const pdfBytes = Uint8Array.from(Buffer.from(fileData.content, 'base64'));
    
    // Count total pages
    const totalPages = await countPdfPages(pdfBytes);
    
    if (process.env.NODE_ENV !== 'production') {
      console.info('PDF analysis', { totalPages, sizeKB: fileData.sizeKB });
    }

    // Check hard page limit (>60 pages = 413)
    if (totalPages > MAX_PAGES_TOTAL) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: `PDF demasiado largo (${totalPages} págs). Divide y reintenta (máx. ${MAX_PAGES_TOTAL} páginas).`
        })
      };
    }

    // Determine processing mode
    const shouldUseBackground = totalPages > BACKGROUND_THRESHOLD_PAGES || 
                               fileData.sizeKB > BACKGROUND_THRESHOLD_KB;

    // Generate document and job IDs
    const docId = generateDocId();
    const jobId = generateJobId();

    if (shouldUseBackground) {
      // Use background processing mode
      console.info('Using background mode', { totalPages, sizeKB: fileData.sizeKB, mode: 'background' });
      
      // Initialize job status
      const now = new Date().toISOString();
      await setJobStatus(jobId, {
        status: 'pending',
        progress: { 
          percent: 0, 
          pagesTotal: totalPages 
        },
        createdAt: now,
        updatedAt: now
      });

      // Call background function
      callBackgroundFunction(jobId, fileData.content).catch(error => {
        console.error('Background function call failed:', error);
      });

      return {
        statusCode: 202,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          mode: 'background',
          jobId,
          message: 'Procesando FEIN en segundo plano'
        })
      };
    }

    // Use synchronous processing with timeout
    console.info('Using sync mode', { totalPages, sizeKB: fileData.sizeKB, mode: 'sync' });

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const processingSyncPromise = processSynchronously(pdfBytes, totalPages, docId);
      
      // Race between processing and timeout
      const result = await Promise.race([
        processingSyncPromise,
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('TIMEOUT'));
          });
        })
      ]);

      clearTimeout(timeoutId);
      const totalTime = Date.now() - startTime;

      if (process.env.NODE_ENV !== 'production') {
        console.info('Sync processing completed', { 
          totalPages, 
          chunks: Math.ceil(totalPages / PAGES_PER_CHUNK),
          ms_total_sync: totalTime, 
          mode: 'sync'
        });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result)
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.message === 'TIMEOUT') {
        // Timeout occurred, fallback to background mode
        console.info('Sync timeout, falling back to background', { 
          totalPages, 
          timeoutMs: SYNC_TIMEOUT_MS, 
          mode: 'background' 
        });

        // Initialize job status
        const now = new Date().toISOString();
        await setJobStatus(jobId, {
          status: 'pending',
          progress: { 
            percent: 0, 
            pagesTotal: totalPages 
          },
          createdAt: now,
          updatedAt: now
        });

        // Call background function
        callBackgroundFunction(jobId, fileData.content).catch(bgError => {
          console.error('Background function call failed after timeout:', bgError);
        });

        return {
          statusCode: 202,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            mode: 'background',
            jobId,
            message: 'Procesando FEIN en segundo plano'
          })
        };
      }

      // Other processing error
      throw error;
    }

  } catch (error) {
    console.error('FEIN OCR Error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Error procesando el documento (chunk')) {
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: error.message
          })
        };
      }
      
      if (error.message.includes('Error analizando PDF')) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'PDF corrupto o no válido'
          })
        };
      }
    }

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

// Process PDF synchronously with chunking for >15 pages
const processSynchronously = async (pdfBytes: Uint8Array, totalPages: number, docId: string): Promise<any> => {
  // Single chunk optimization for ≤15 pages
  if (totalPages <= PAGES_PER_CHUNK) {
    console.info(`Single chunk processing: ${totalPages} pages`);
    
    const result = await processChunkWithDocAI(pdfBytes, 0);
    
    if (!result.success) {
      throw new Error('Error procesando el documento (chunk 1)');
    }

    // Extract entities and text
    const ocrResult = result.results[0];
    
    // Normalize FEIN data
    const normalizedResult = normalizeFeinFromDocAI({
      entities: ocrResult.entities || [],
      text: ocrResult.text || ''
    });

    return {
      success: true,
      providerUsed: 'docai',
      docId,
      fields: normalizedResult?.fields || {},
      confidenceGlobal: normalizedResult?.confidenceGlobal || 0,
      pending: normalizedResult?.pending || []
    };
  }

  // Multi-chunk processing for >15 pages
  console.info(`Multi-chunk processing: ${totalPages} pages, chunks: ${Math.ceil(totalPages / PAGES_PER_CHUNK)}`);
  
  const chunks = await splitPdfIntoChunks(pdfBytes, PAGES_PER_CHUNK);
  const chunkResults: any[] = [];

  // Process chunks with controlled concurrency
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
    throw new Error(`Error procesando el documento (chunk ${failedChunk.chunkIndex + 1})`);
  }

  // Aggregate results
  const aggregatedResult = aggregateChunkResults(chunkResults, totalPages);
  
  // Extract entities and text from aggregated result
  const ocrResult = aggregatedResult.results[0];
  
  // Normalize FEIN data
  const normalizedResult = normalizeFeinFromDocAI({
    entities: ocrResult.entities || [],
    text: ocrResult.text || ''
  });

  return {
    success: true,
    providerUsed: 'docai',
    docId,
    fields: normalizedResult?.fields || {},
    confidenceGlobal: normalizedResult?.confidenceGlobal || 0,
    pending: normalizedResult?.pending || []
  };
};
