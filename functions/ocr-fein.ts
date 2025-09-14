// FEIN OCR Endpoint - Pure synchronous DocAI processing
// Processes PDF documents directly without jobs, blobs, or polling

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PDFDocument } from 'pdf-lib';
import { normalizeFeinFromDocAI } from '../src/services/ocr/normalize-docai';
import { processWithDocAI } from '../src/services/documentaiClient';

// Constants for processing
const MAX_PAGES_SYNC = 15; // Maximum pages for synchronous processing

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();
  
  console.info('FEIN OCR Request', { 
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

  // Reject GET requests (no more job polling)
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'GET no soportado. Use POST para procesamiento directo.'
      })
    };
  }

  // Only accept POST requests for processing
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'Método no permitido'
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
          code: 'INVALID_ARGUMENT',
          message: 'Archivo no recibido'
        })
      };
    }

    // Convert to PDF bytes for analysis
    const pdfBytes = Uint8Array.from(Buffer.from(fileData.content, 'base64'));
    
    // Count total pages
    const totalPages = await countPdfPages(pdfBytes);
    
    console.info('PDF analysis', { totalPages, sizeKB: fileData.sizeKB });

    // Check 15-page limit for synchronous processing
    if (totalPages > MAX_PAGES_SYNC) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          code: 'DOC_TOO_LARGE_SYNC',
          status: 413,
          message: `El documento excede el límite de ${MAX_PAGES_SYNC} páginas para procesamiento directo. Sube una versión más corta o introdúcelo manualmente.`
        })
      };
    }

    // Process with DocAI synchronously
    console.info('Processing with DocAI', { totalPages, mode: 'sync' });
    
    const docAIResult = await processWithDocAI({
      base64: fileData.content,
      mime: fileData.mimeType
    });

    if (!docAIResult.success) {
      // Handle DocAI errors with proper mapping
      const errorResult = docAIResult.results[0];
      let statusCode = 500;
      let code = 'INTERNAL_ERROR';
      let message = 'Error interno del servicio OCR';

      if (errorResult?.error) {
        const errorText = errorResult.error;
        
        // Check for specific DocAI errors
        if (errorText.includes('Document pages') && errorText.includes('exceed the limit: 15')) {
          statusCode = 413;
          code = 'DOC_TOO_LARGE_SYNC';
          message = `El documento excede el límite de ${MAX_PAGES_SYNC} páginas para procesamiento directo. Sube una versión más corta o introdúcelo manualmente.`;
        } else if (errorText.includes('403') || errorText.includes('Sin permisos')) {
          statusCode = 403;
          code = 'PERMISSION_DENIED';
          message = 'Sin permisos para OCR';
        } else if (errorText.includes('404') || errorText.includes('no encontrado')) {
          statusCode = 404;
          code = 'NOT_FOUND';
          message = 'Servicio OCR no encontrado';
        } else if (errorText.includes('CONFIG')) {
          statusCode = 500;
          code = 'CONFIG_ERROR';
          message = 'Error de configuración del servicio OCR';
        }
      }

      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          code,
          message
        })
      };
    }

    // Extract entities and text from successful result
    const ocrResult = docAIResult.results[0];
    
    // Normalize FEIN data
    const normalizedResult = normalizeFeinFromDocAI({
      entities: ocrResult.entities || [],
      text: ocrResult.text || ''
    });

    const totalTime = Date.now() - startTime;
    console.info('DocAI done', { provider: 'docai', ms: totalTime });

    // Return normalized response format (< 100KB)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        providerUsed: 'docai',
        fields: normalizedResult?.fields || {},
        pending: normalizedResult?.pending || [],
        confidenceGlobal: normalizedResult?.confidenceGlobal || 0
      })
    };

  } catch (error) {
    console.error('FEIN OCR Error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Error analizando PDF')) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            code: 'INVALID_PDF',
            message: 'PDF corrupto o no válido'
          })
        };
      }
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      })
    };
  }
};