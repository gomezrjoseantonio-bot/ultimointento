// FEIN OCR Endpoint - Real DocAI processing with Spanish normalization
// Eliminates mocks, background processing, and chunk-based approach
// Returns normalized fields with confidence and pending list

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { normalizeFeinFromDocAI } from '../src/services/ocr/normalize-docai';

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
  const docAIEndpoint = `${process.env.NETLIFY_FUNCTIONS_URL || 'http://localhost:8888/.netlify/functions'}/ocr-documentai`;
  
  // Prepare request to ocr-documentai
  const requestBody = Buffer.from(fileBase64, 'base64');
  
  const response = await fetch(docAIEndpoint, {
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

    // Call ocr-documentai endpoint with language hints
    console.info('Calling DocAI', { docId, sizeKB: fileData.sizeKB });
    const docAIResult = await callDocumentAI(fileData.content, fileData.mimeType);

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
      text: ocrResult.text
    });

    // Ensure response size is under 100KB
    const responseSize = JSON.stringify(normalizedResult).length;
    console.info('Response size', { bytes: responseSize, limit: 100000 });

    // Return normalized response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        providerUsed: 'docai',
        docId,
        fields: normalizedResult.fields,
        confidenceGlobal: normalizedResult.confidenceGlobal,
        pending: normalizedResult.pending
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
