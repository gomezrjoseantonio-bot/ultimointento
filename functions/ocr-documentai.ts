// PROMPT COPILOT — FIX ocr-documentai → usar rawDocument + base64 correcto (EU)
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GoogleAuth } from 'google-auth-library';

// Fixed interface definitions - use rawDocument instead of document
interface DocumentAIRequest {
  rawDocument: {
    content: string; // Base64 encoded
    mimeType: string;
  };
}

interface DocumentAIResponse {
  document: {
    entities?: Array<{
      type: string;
      mentionText: string;
      normalizedValue?: {
        text?: string;
        moneyValue?: {
          currencyCode: string;
          units: string;
          nanos: number;
        };
        dateValue?: {
          year: number;
          month: number;
          day: number;
        };
      };
      confidence: number;
      pageAnchor?: {
        pageRefs: Array<{
          page: number;
        }>;
      };
    }>;
    pages?: Array<{
      pageNumber: number;
      dimension?: {
        width: number;
        height: number;
      };
    }>;
    text?: string;
  };
}

// Supported MIME types for processing
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 
  'image/png'
];

// Validate environment configuration
const validateEnvironment = (): { isValid: boolean; error?: string; } => {
  const requiredVars = [
    'DOC_AI_SA_JSON_B64',
    'DOC_AI_PROJECT_ID', 
    'DOC_AI_LOCATION',
    'DOC_AI_PROCESSOR_ID'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `CONFIG: OCR no configurado correctamente`
    };
  }

  return { isValid: true };
};

// Create authenticated Google client
const createAuthenticatedClient = async (): Promise<string> => {
  try {
    const serviceAccountJson = Buffer.from(
      process.env.DOC_AI_SA_JSON_B64!,
      'base64'
    ).toString('utf-8');
    
    const credentials = JSON.parse(serviceAccountJson);
    
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('No access token received');
    }

    return accessToken.token;
  } catch (error) {
    throw new Error('Error al configurar autenticación con Google Cloud');
  }
};

// Main handler function
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Log request safely without exposing secrets  
  const endpointHost = 'eu-documentai.googleapis.com';
  console.info("OCR Request", { endpointHost, method: "POST" });

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        status: 405,
        message: 'Método no permitido' 
      })
    };
  }

  // Validate environment configuration
  const envValidation = validateEnvironment();
  if (!envValidation.isValid) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false,
        code: 'CONFIG',
        status: 403,
        message: envValidation.error
      })
    };
  }

  try {
    // Handle file input based on content type
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    let fileBase64: string;
    let fileMime: string;
    
    if (!contentType.includes('application/octet-stream')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          code: 'INVALID_ARGUMENT',
          status: 400,
          message: 'Se requiere Content-Type: application/octet-stream' 
        })
      };
    }

    // Handle base64 encoding based on event.isBase64Encoded
    if (event.isBase64Encoded === true) {
      // Body is already base64, use it directly
      fileBase64 = event.body || '';
    } else {
      // Convert body string to base64
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            success: false,
            code: 'INVALID_ARGUMENT',
            status: 400,
            message: 'Fichero vacío o no recibido' 
          })
        };
      }
      fileBase64 = Buffer.from(event.body, 'binary').toString('base64');
    }

    // Detect MIME type with priority to headers
    if (contentType.includes('application/pdf')) {
      fileMime = 'application/pdf';
    } else if (contentType.includes('image/jpeg')) {
      fileMime = 'image/jpeg';
    } else if (contentType.includes('image/png')) {
      fileMime = 'image/png';
    } else {
      // Default fallback to PDF
      fileMime = 'application/pdf';
    }

    // Check if empty body
    if (!fileBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          results: [{
            status: 'error',
            error: 'Fichero vacío o no recibido',
            entities: [],
            pages: []
          }],
          code: 'INVALID_ARGUMENT',
          status: 400,
          message: 'Fichero vacío o no recibido' 
        })
      };
    }

    // Validate MIME type against supported types
    if (!SUPPORTED_MIME_TYPES.includes(fileMime)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false,
          results: [{
            status: 'error',
            error: `Tipo MIME no soportado: ${fileMime}. Tipos válidos: ${SUPPORTED_MIME_TYPES.join(', ')}`,
            entities: [],
            pages: []
          }],
          code: 'INVALID_MIME_TYPE',
          status: 400,
          message: `Tipo MIME no soportado: ${fileMime}` 
        })
      };
    }

    // Calculate file size
    const fileSizeKB = Math.round((fileBase64.length * 3) / 4 / 1024); // Approximate KB from base64
    
    // Log file info safely
    console.info("File info", { fileMime, fileSizeKB, fileName: "document.pdf" });

    // Get access token
    const accessToken = await createAuthenticatedClient();

    // Construct processor path for EU region
    const processorPath = `https://eu-documentai.googleapis.com/v1/projects/${process.env.DOC_AI_PROJECT_ID}/locations/${process.env.DOC_AI_LOCATION}/processors/${process.env.DOC_AI_PROCESSOR_ID}:process`;
    
    // Build correct request body with rawDocument instead of document
    const requestBody: DocumentAIRequest = {
      rawDocument: {
        content: fileBase64,
        mimeType: fileMime
      }
    };

    // Call Google Document AI
    const response = await fetch(processorPath, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
      // Parse error response and return structured error
      let errorMessage = responseText.slice(0, 180);
      let errorCode = response.status.toString();
      
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message.slice(0, 180);
        }
        if (errorJson.error?.status) {
          errorCode = errorJson.error.status;
        }
      } catch {
        // Use original response text if not JSON
      }

      console.error("Document AI processing error", { 
        status: response.status, 
        errorCode,
        message: errorMessage 
      });

      // Return proper error format based on status
      let userMessage = errorMessage;
      if (response.status === 403) {
        userMessage = "403: Sin permisos para OCR";
      } else if (response.status === 404) {
        userMessage = "404: Servicio OCR no encontrado";
      } else if (response.status >= 500) {
        userMessage = "Error interno del servicio OCR";
      }

      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          results: [{
            status: 'error',
            error: userMessage,
            entities: [],
            pages: []
          }],
          code: errorCode,
          status: response.status,
          message: userMessage
        })
      };
    }

    // Parse successful response
    const result: DocumentAIResponse = JSON.parse(responseText);
    
    // Return success response in required format for documentAIService
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        results: [{
          status: 'success',
          entities: result.document.entities || [],
          pages: result.document.pages || [],
          text: result.document.text || ''
        }],
        meta: {
          endpointHost: "eu-documentai.googleapis.com",
          mimeType: fileMime,
          sizeKB: fileSizeKB
        }
      })
    };

  } catch (error) {
    console.error("Document AI processing error", { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        results: [{
          status: 'error',
          error: 'Error interno del servidor OCR',
          entities: [],
          pages: []
        }],
        code: 'INTERNAL_ERROR',
        status: 500,
        message: 'Error interno del servidor OCR'
      })
    };
  }
};
