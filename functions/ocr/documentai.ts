// H-OCR-FIX: Google Document AI — Invoice Parser (EU) Netlify Function
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GoogleAuth } from 'google-auth-library';
import JSZip from 'jszip';

// H-OCR-FIX: Interface definitions
interface DocumentAIRequest {
  document: {
    content: string; // Base64 encoded
    mimeType: string;
  };
  rawDocument?: {
    content: string;
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
    revisions?: Array<{
      agent: string;
      processor: string;
      id: string;
    }>;
  };
}

interface ProcessingResult {
  entities: any[];
  pages?: any[];
  text?: string;
  revisions?: any[];
}

// H-OCR-FIX: Supported MIME types for processing
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
  'image/webp'
];

// H-OCR-FIX: Archive MIME types that need extraction
const ARCHIVE_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'message/rfc822' // EML files
];

// H-OCR-FIX: Maximum files to process from archives
const MAX_ARCHIVE_FILES = 15;

// H-OCR-FIX: Validate environment configuration
const validateEnvironment = (): {
  isValid: boolean;
  error?: string;
} => {
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
      error: `OCR: configuración incompleta - faltan variables: ${missing.join(', ')}`
    };
  }

  return { isValid: true };
};

// H-OCR-FIX: Create authenticated Google client
const createAuthenticatedClient = async (): Promise<GoogleAuth> => {
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

    return auth;
  } catch (error) {
    throw new Error('Error al configurar autenticación con Google Cloud');
  }
};

// H-OCR-FIX: Extract files from ZIP/EML archives
const extractArchiveFiles = async (
  fileBuffer: Buffer,
  mimeType: string
): Promise<Array<{ content: Buffer; filename: string; mimeType: string }>> => {
  const extractedFiles: Array<{ content: Buffer; filename: string; mimeType: string }> = [];

  if (mimeType.includes('zip')) {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(fileBuffer);
      
      let fileCount = 0;
      
      for (const filename of Object.keys(zipContent.files)) {
        if (fileCount >= MAX_ARCHIVE_FILES) break;
        
        const file = zipContent.files[filename];
        if (file.dir) continue; // Skip directories
        
        const detectedMimeType = detectMimeTypeFromFilename(filename);
        if (!SUPPORTED_MIME_TYPES.includes(detectedMimeType)) continue;
        
        const content = await file.async('nodebuffer');
        extractedFiles.push({
          content,
          filename,
          mimeType: detectedMimeType
        });
        
        fileCount++;
      }
    } catch (error) {
      console.error('Error extracting ZIP file:', error);
    }
  } else if (mimeType === 'message/rfc822') {
    // Simple EML attachment extraction
    // Note: This is a basic implementation - in production you'd use a proper EML parser
    const emlContent = fileBuffer.toString('utf-8');
    
    // Look for Content-Type: application/pdf or image/* attachments
    const attachmentRegex = /Content-Type:\s*(application\/pdf|image\/[^;]+)[^]*?Content-Transfer-Encoding:\s*base64[^]*?\n\n([A-Za-z0-9+/=\s]+)/gi;
    let match;
    let fileCount = 0;
    
    while ((match = attachmentRegex.exec(emlContent)) && fileCount < MAX_ARCHIVE_FILES) {
      try {
        const mimeType = match[1];
        const base64Content = match[2].replace(/\s/g, '');
        const content = Buffer.from(base64Content, 'base64');
        
        if (SUPPORTED_MIME_TYPES.includes(mimeType)) {
          extractedFiles.push({
            content,
            filename: `attachment_${fileCount + 1}.${mimeType.split('/')[1]}`,
            mimeType
          });
          fileCount++;
        }
      } catch (error) {
        console.error('Error extracting EML attachment:', error);
      }
    }
  }

  return extractedFiles;
};

// H-OCR-FIX: Detect MIME type from filename extension
const detectMimeTypeFromFilename = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'tiff':
    case 'tif': return 'image/tiff';
    case 'bmp': return 'image/bmp';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
};

// H-OCR-FIX: Process single document with Google Document AI
const processDocument = async (
  documentContent: Buffer,
  mimeType: string,
  auth: GoogleAuth
): Promise<ProcessingResult> => {
  // ATLAS HOTFIX: Use hardcoded EU endpoint to ensure correct region
  const endpoint = 'https://eu-documentai.googleapis.com';
  const processorPath = `projects/${process.env.DOC_AI_PROJECT_ID}/locations/${process.env.DOC_AI_LOCATION}/processors/${process.env.DOC_AI_PROCESSOR_ID}`;
  
  const base64Content = documentContent.toString('base64');
  
  const requestBody: DocumentAIRequest = {
    document: {
      content: base64Content,
      mimeType: mimeType
    }
  };

  try {
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    const response = await fetch(`${endpoint}/v1/${processorPath}:process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Document AI API error: ${response.status} - ${errorText}`);
    }

    const result: DocumentAIResponse = await response.json();
    
    // Return passthrough of relevant JSON data
    return {
      entities: result.document.entities || [],
      pages: result.document.pages || [],
      text: result.document.text,
      revisions: result.document.revisions || []
    };
  } catch (error) {
    console.error('Document AI processing error:', error);
    throw error;
  }
};

// H-OCR-FIX: Main handler function
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // ATLAS HOTFIX: Log safely without exposing secrets  
  const endpointHost = 'eu-documentai.googleapis.com'; // Hardcoded EU endpoint
  const hasKey = !!process.env.DOC_AI_SA_JSON_B64;
  const projectIsNumber = !isNaN(Number(process.env.DOC_AI_PROJECT_ID));
  const processorIdLen = process.env.DOC_AI_PROCESSOR_ID?.length || 0;
  
  console.log('OCR Request:', {
    endpointHost,
    hasKey,
    projectIsNumber,
    processorIdLen,
    method: event.httpMethod
  });

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
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  // Validate environment configuration
  const envValidation = validateEnvironment();
  if (!envValidation.isValid) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: envValidation.error })
    };
  }

  try {
    // Parse multipart form data
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Se requiere multipart/form-data' })
      };
    }

    // Extract file from form data (basic implementation)
    // Note: In production, you'd use a proper multipart parser
    const body = event.isBase64Encoded 
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf-8');

    // Simple extraction of file content from multipart data
    // This is a simplified approach - in production use proper multipart parsing
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Formato multipart inválido' })
      };
    }

    const parts = body.toString('binary').split(`--${boundary}`);
    let fileBuffer: Buffer | null = null;
    let fileMime = '';
    let fileName = '';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data') && part.includes('filename=')) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          fileName = filenameMatch[1];
        }
        
        const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);
        if (contentTypeMatch) {
          fileMime = contentTypeMatch[1].trim();
        }
        
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const fileContent = part.substring(headerEnd + 4);
          // Remove trailing boundary markers
          const cleaned = fileContent.replace(/\r\n--.*$/, '');
          fileBuffer = Buffer.from(cleaned, 'binary');
          break;
        }
      }
    }

    if (!fileBuffer) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No se encontró archivo en la solicitud' })
      };
    }

    // Log file info safely
    const fileSizeKB = Math.round(fileBuffer.length / 1024);
    console.log('File info:', { fileMime, fileSizeKB, fileName });

    // Create authenticated client
    const auth = await createAuthenticatedClient();

    let filesToProcess: Array<{ content: Buffer; filename: string; mimeType: string }> = [];

    // Check if file is an archive that needs extraction
    if (ARCHIVE_MIME_TYPES.includes(fileMime)) {
      const extractedFiles = await extractArchiveFiles(fileBuffer, fileMime);
      filesToProcess = extractedFiles;
      
      console.log('Archive processing:', { 
        numAttachments: extractedFiles.length,
        fileTypes: extractedFiles.map(f => f.mimeType)
      });
    } else if (SUPPORTED_MIME_TYPES.includes(fileMime)) {
      filesToProcess = [{
        content: fileBuffer,
        filename: fileName,
        mimeType: fileMime
      }];
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: `Tipo de archivo no soportado: ${fileMime}. Tipos válidos: ${SUPPORTED_MIME_TYPES.join(', ')}` 
        })
      };
    }

    if (filesToProcess.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'No se encontraron archivos válidos para procesar' 
        })
      };
    }

    // ATLAS HOTFIX: Process all files with telemetry
    const results: any[] = [];
    
    for (const file of filesToProcess) {
      try {
        const fileStartTime = Date.now();
        const result = await processDocument(file.content, file.mimeType, auth);
        const processTime = Date.now() - fileStartTime;
        
        // Log processing metrics
        console.log('OCR File processed:', {
          filename: file.filename,
          processTimeMs: processTime,
          entitiesCount: result.entities.length,
          pagesCount: result.pages?.length || 0
        });
        
        // QA: Calculate confidence metrics
        const confidences = result.entities.map(e => e.confidence);
        const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
        const entitiesAbove80 = result.entities.filter(e => e.confidence >= 0.80).length;
        
        console.log('QA Check - OCR Confidence:', {
          avgConfidence,
          entitiesAbove80,
          totalEntities: result.entities.length,
          thresholdRespected: entitiesAbove80 > 0 || result.entities.length === 0
        });
        
        results.push({
          filename: file.filename,
          mimeType: file.mimeType,
          status: 'success',
          ...result
        });
      } catch (error) {
        console.error(`Error processing ${file.filename}:`, error);
        results.push({
          filename: file.filename,
          mimeType: file.mimeType,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        results,
        processedFiles: results.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('OCR Function Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Error interno del servidor OCR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      })
    };
  }
};