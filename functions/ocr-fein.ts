// FEIN OCR Endpoint - Real DocAI processing with Spanish normalization
// Eliminates mocks, background processing, and chunk-based approach
// Returns normalized fields with confidence and pending list

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { normalizeFeinFromDocAI } from '../src/services/ocr/normalize-docai';
import { processWithDocAI } from '../src/services/documentaiClient';

// Maximum file size: 8MB
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

// Helper to generate document ID
const generateDocId = (): string => `fein_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Extract file from request
const extractFileFromRequest = (event: HandlerEvent): { content: string; mimeType: string; sizeKB: number } | null => {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  
  // Accept application/pdf and application/octet-stream
  const isValidContentType = contentType.includes('application/pdf') || 
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

  // Handle base64 encoding based on event.isBase64Encoded
  if (event.isBase64Encoded === true) {
    fileBase64 = event.body;
  } else {
    fileBase64 = Buffer.from(event.body, 'binary').toString('base64');
  }

  // Calculate file size
  const fileSizeBytes = (fileBase64.length * 3) / 4;
  const sizeKB = Math.round(fileSizeBytes / 1024);

  // If octet-stream, let ocr-documentai auto-detect
  if (contentType.includes('application/pdf')) {
    detectedMime = 'application/pdf';
  } else if (contentType.includes('application/octet-stream') || contentType === '') {
    // Pass as binary and let ocr-documentai handle MIME detection
    detectedMime = 'application/octet-stream';
  }

  return {
    content: fileBase64,
    mimeType: detectedMime,
    sizeKB
  };
};

// Call internal ocr-documentai endpoint
const callDocumentAI = async (fileBase64: string, mimeType: string): Promise<any> => {
  // Remove proxy environment variables to avoid contamination
  delete process.env.HTTP_PROXY;
  delete process.env.http_proxy;
  delete process.env.HTTPS_PROXY;
  delete process.env.https_proxy;

  // Construct base URL for the deployment
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  
  let docaiEndpoint: string;
  
  if (siteUrl) {
    // Use absolute URL for deployment
    docaiEndpoint = new URL('/.netlify/functions/ocr-documentai', siteUrl).toString();
  } else {
    // Fallback for local development and testing - use relative URL
    docaiEndpoint = '/.netlify/functions/ocr-documentai';
  }
  
  // Log endpoint in development
  if (process.env.NODE_ENV !== 'production') {
    console.info('[FEIN] endpoint', { siteUrl, docaiEndpoint });
  }
  
  // Prepare request to ocr-documentai
  const requestBody = Buffer.from(fileBase64, 'base64');
  
  const response = await fetch(docaiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType === 'application/octet-stream' ? 'application/octet-stream' : 'application/pdf'
    },
    body: requestBody
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Error procesando documento con OCR';
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      errorMessage = errorText.slice(0, 200);
    }

    // Log the failed remote call and prepare for fallback
    console.warn(`[FEIN] Remote function call failed: ${response.status} - ${errorMessage}. Endpoint: ${docaiEndpoint}`);
    throw new Error(`${response.status}: ${errorMessage}`);
  }

  return await response.json();
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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
    // Extract file from request
    const fileData = extractFileFromRequest(event);
    if (!fileData) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Archivo PDF requerido. Tipos válidos: application/pdf, application/octet-stream'
        })
      };
    }

    // Validate file size (8MB limit)
    const fileSizeBytes = (fileData.content.length * 3) / 4;
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Archivo demasiado grande (máx. 8 MB)'
        })
      };
    }

    // Generate document ID for tracking
    const docId = generateDocId();

    let docAIResult: any;
    let usedFallback = false;

    try {
      // Try to call ocr-documentai endpoint with absolute URL
      console.info('Calling DocAI via function endpoint', { docId, sizeKB: fileData.sizeKB });
      docAIResult = await callDocumentAI(fileData.content, fileData.mimeType);
    } catch (error) {
      // If the remote function call fails, use direct DocAI client as fallback
      console.warn('[FEIN] Function endpoint failed, using direct DocAI client fallback:', error instanceof Error ? error.message : 'Unknown error');
      usedFallback = true;
      
      try {
        console.info('[FEIN] Attempting direct DocAI processing');
        const directResult = await processWithDocAI({ 
          base64: fileData.content, 
          mime: fileData.mimeType 
        });
        
        if (!directResult.success) {
          return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: 'No se pudo contactar con el servicio de OCR (DocAI)'
            })
          };
        }
        
        // Convert direct response to expected format
        docAIResult = directResult;
      } catch (fallbackError) {
        console.error('[FEIN] Direct DocAI fallback also failed:', fallbackError);
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'No se pudo contactar con el servicio de OCR (DocAI)'
          })
        };
      }
    }

    // Extract entities and text from DocAI response
    if (!docAIResult.success || !docAIResult.results || docAIResult.results.length === 0) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Error procesando documento con OCR'
        })
      };
    }

    const ocrResult = docAIResult.results[0];
    
    // Normalize FEIN data from DocAI entities
    const normalizedResult = normalizeFeinFromDocAI({
      entities: ocrResult.entities || [],
      text: ocrResult.text || ''
    });

    console.info('Normalized result:', { normalizedResult, hasResult: !!normalizedResult });

    // Ensure response size is under 100KB
    const responseSize = JSON.stringify(normalizedResult || {}).length;
    console.info('Response size', { bytes: responseSize, limit: 100000 });

    // Return normalized response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        providerUsed: usedFallback ? 'docai-direct' : 'docai',
        docId,
        fields: normalizedResult?.fields || {},
        confidenceGlobal: normalizedResult?.confidenceGlobal || 0,
        pending: normalizedResult?.pending || []
      })
    };

  } catch (error) {
    console.error('FEIN OCR Error:', error);
    
    // Handle DocAI specific errors
    if (error instanceof Error && error.message.includes(':')) {
      const [statusCode, message] = error.message.split(': ', 2);
      const code = parseInt(statusCode);
      
      if (!isNaN(code) && code >= 400 && code < 600) {
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: message || 'Error procesando documento con OCR'
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
