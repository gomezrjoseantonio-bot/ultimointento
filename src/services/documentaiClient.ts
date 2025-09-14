// Shared Document AI client for direct Google Cloud Document AI processing
// Extracted from functions/ocr-documentai.ts for reuse in fallback scenarios

import { GoogleAuth } from 'google-auth-library';

export interface DocumentAIResponse {
  success: boolean;
  results: Array<{
    status: 'success' | 'error';
    entities: Array<{
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
    error?: string;
  }>;
  meta?: {
    endpointHost: string;
    mimeType: string;
    sizeKB: number;
  };
}

interface DocumentAIRequest {
  rawDocument: {
    content: string; // Base64 encoded
    mimeType: string;
  };
}

// Supported MIME types for processing
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 
  'image/png'
];

// Detect MIME type from file content using magic numbers
const detectMimeFromContent = (base64Content: string): string | null => {
  try {
    // Decode first few bytes to check magic numbers
    const buffer = Buffer.from(base64Content.slice(0, 32), 'base64');
    
    // PDF: starts with %PDF-
    if (buffer.toString('utf8', 0, 4) === '%PDF') {
      return 'application/pdf';
    }
    
    // JPEG: starts with 0xFF, 0xD8, 0xFF
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }
    
    // PNG: starts with 0x89, 'P', 'N', 'G'
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }
    
    return null;
  } catch {
    return null;
  }
};

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

/**
 * Process document directly with Google Document AI
 * @param base64 - Base64 encoded file content
 * @param mime - MIME type of the file
 * @returns Promise with Document AI response
 */
export async function processWithDocAI({ base64, mime }: { base64: string; mime: string }): Promise<DocumentAIResponse> {
  // Validate environment configuration
  const envValidation = validateEnvironment();
  if (!envValidation.isValid) {
    return {
      success: false,
      results: [{
        status: 'error',
        error: envValidation.error || 'OCR configuration error',
        entities: [],
        pages: []
      }]
    };
  }

  try {
    let fileMime = mime;
    
    // Detect MIME type if needed
    if (mime === 'application/octet-stream' || !mime) {
      const detectedMime = detectMimeFromContent(base64);
      if (detectedMime) {
        fileMime = detectedMime;
      } else {
        return {
          success: false,
          results: [{
            status: 'error',
            error: 'Tipo MIME no reconocido. Tipos válidos: application/pdf, image/jpeg, image/png',
            entities: [],
            pages: []
          }]
        };
      }
    }

    // Validate MIME type against supported types
    if (!SUPPORTED_MIME_TYPES.includes(fileMime)) {
      return {
        success: false,
        results: [{
          status: 'error',
          error: `Tipo MIME no soportado: ${fileMime}. Tipos válidos: ${SUPPORTED_MIME_TYPES.join(', ')}`,
          entities: [],
          pages: []
        }]
      };
    }

    // Calculate file size and check 8MB limit
    const fileSizeKB = Math.round((base64.length * 3) / 4 / 1024);
    
    if (fileSizeKB > 8192) {
      return {
        success: false,
        results: [{
          status: 'error',
          error: 'Archivo demasiado grande (máx. 8 MB)',
          entities: [],
          pages: []
        }]
      };
    }

    // Get access token
    const accessToken = await createAuthenticatedClient();

    // Construct processor path for EU region
    const processorPath = `https://eu-documentai.googleapis.com/v1/projects/${process.env.DOC_AI_PROJECT_ID}/locations/${process.env.DOC_AI_LOCATION}/processors/${process.env.DOC_AI_PROCESSOR_ID}:process`;
    
    // Build correct request body with rawDocument only
    const requestBody: DocumentAIRequest = {
      rawDocument: {
        content: base64,
        mimeType: fileMime
      }
    };
    
    // Add development logging
    if (process.env.NODE_ENV !== 'production') {
      console.info('[DocAI] request sent without processOptions');
    }

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
      // Parse error response
      let errorMessage = responseText.slice(0, 180);
      
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message.slice(0, 180);
        }
      } catch {
        // Use original response text if not JSON
      }

      // Log error only in development
      if (process.env.NODE_ENV !== 'production') {
        console.error("Document AI processing error", { 
          status: response.status, 
          message: errorMessage,
          endpointHost: "eu-documentai.googleapis.com"
        });
      }

      // Return proper error format
      let userMessage = errorMessage;
      if (response.status === 403) {
        userMessage = "403: Sin permisos para OCR";
      } else if (response.status === 404) {
        userMessage = "404: Servicio OCR no encontrado";
      } else if (response.status >= 500) {
        userMessage = "Error interno del servicio OCR";
      }

      return {
        success: false,
        results: [{
          status: 'error',
          error: userMessage,
          entities: [],
          pages: []
        }]
      };
    }

    // Parse successful response
    const result = JSON.parse(responseText);
    
    // Return success response in required format
    return {
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
    };

  } catch (error) {
    // Log error only in development
    if (process.env.NODE_ENV !== 'production') {
      console.error("Document AI processing error", { 
        error: error instanceof Error ? error.message : 'Unknown error',
        endpointHost: "eu-documentai.googleapis.com"
      });
    }
    
    return {
      success: false,
      results: [{
        status: 'error',
        error: 'Error interno del servicio OCR',
        entities: [],
        pages: []
      }]
    };
  }
}