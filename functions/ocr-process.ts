// Unified OCR Processing Function for ATLAS Horizon
// Implements exact requirements from comprehensive OCR instructions

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GoogleAuth } from 'google-auth-library';

// Environment validation
const ENV_VARS = {
  DOC_AI_PROJECT_ID: process.env.DOC_AI_PROJECT_ID,
  DOC_AI_PROCESSOR_ID: process.env.DOC_AI_PROCESSOR_ID,
  DOC_AI_LOCATION: process.env.DOC_AI_LOCATION || 'eu',
  GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
};

// Input/Output interfaces as per requirements
interface OCRRequest {
  fileBase64: string;
  mimeType: string;
  filename?: string;
}

interface OCRResponse {
  success: boolean;
  data?: {
    // Required extracted fields
    supplier_name?: string | null;
    supplier_tax_id?: string | null; // CIF/NIF
    total_amount?: number | null;
    net_amount?: number | null;
    tax_amount?: number | null;
    issue_date?: string | null; // ISO yyyy-mm-dd
    due_date?: string | null;
    service_address?: string | null;
    iban_mask?: string | null;
    
    // Utility detection
    utility_type?: 'Luz' | 'Agua' | 'Gas' | 'Internet' | null;
    
    // Reform/construction categorization (AEAT categories)
    categories?: {
      mejora?: number;
      mobiliario?: number;
      reparacion_conservacion?: number;
    };
    
    // Raw extraction for debugging
    raw_entities?: any[];
    extracted_text?: string;
  };
  error?: string;
  confidence?: number;
}

// Supported file types
const SUPPORTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

// Utility type detection patterns
const UTILITY_PATTERNS = {
  Luz: ['iberdrola', 'endesa', 'electricidad', 'luz', 'electric', 'kwh', 'consumo eléctrico', 'energía eléctrica'],
  Agua: ['agua', 'aqualia', 'canal isabel', 'aguas', 'hidro', 'abastecimiento', 'saneamiento', 'm3'],
  Gas: ['gas natural', 'repsol', 'naturgy', 'cepsa', 'gas', 'kwh gas', 'combustible'],
  Internet: ['movistar', 'vodafone', 'orange', 'telecomunicaciones', 'internet', 'fibra', 'adsl', 'banda ancha']
};

// Reform keywords for categorization
const REFORM_PATTERNS = {
  mejora: ['reforma', 'mejora', 'rehabilitación', 'ampliación', 'instalación'],
  mobiliario: ['mobiliario', 'muebles', 'equipamiento', 'electrodomésticos'],
  reparacion_conservacion: ['reparación', 'conservación', 'mantenimiento', 'arreglo', 'fontanería', 'pintura']
};

// Validate environment
function validateEnvironment(): { isValid: boolean; error?: string } {
  const missing = Object.entries(ENV_VARS)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return { 
      isValid: false, 
      error: `Missing environment variables: ${missing.join(', ')}` 
    };
  }

  return { isValid: true };
}

// Create authenticated Google client
async function createGoogleAuth(): Promise<string> {
  try {
    const credentials = JSON.parse(ENV_VARS.GOOGLE_APPLICATION_CREDENTIALS_JSON!);
    
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    return accessToken.token;
  } catch (error) {
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Process document with Document AI
async function processWithDocumentAI(fileBase64: string, mimeType: string): Promise<any> {
  const accessToken = await createGoogleAuth();
  
  const processorPath = `https://${ENV_VARS.DOC_AI_LOCATION}-documentai.googleapis.com/v1/projects/${ENV_VARS.DOC_AI_PROJECT_ID}/locations/${ENV_VARS.DOC_AI_LOCATION}/processors/${ENV_VARS.DOC_AI_PROCESSOR_ID}:process`;
  
  const requestBody = {
    rawDocument: {
      content: fileBase64,
      mimeType: mimeType
    }
  };

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
    let errorMessage = `Document AI error: ${response.status}`;
    try {
      const errorJson = JSON.parse(responseText);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      errorMessage = responseText.slice(0, 200);
    }
    throw new Error(errorMessage);
  }

  return JSON.parse(responseText);
}

// Extract structured data from Document AI response
function extractStructuredData(documentAIResponse: any, filename?: string): OCRResponse['data'] {
  const entities = documentAIResponse.document?.entities || [];
  const fullText = documentAIResponse.document?.text || '';
  
  const extracted: OCRResponse['data'] = {
    raw_entities: entities,
    extracted_text: fullText
  };

  // Extract required fields
  for (const entity of entities) {
    const type = entity.type?.toLowerCase();
    const text = entity.mentionText?.trim();
    const normalizedValue = entity.normalizedValue;

    switch (type) {
      case 'supplier_name':
      case 'vendor_name':
      case 'company_name':
        if (!extracted.supplier_name && text) {
          extracted.supplier_name = text;
        }
        break;

      case 'supplier_tax_id':
      case 'tax_id':
      case 'vat_id':
        if (!extracted.supplier_tax_id && text) {
          // Clean and validate CIF/NIF format
          const cleanTaxId = text.replace(/\s+/g, '').toUpperCase();
          if (/^[A-Z]\d{8}$|^\d{8}[A-Z]$/.test(cleanTaxId)) {
            extracted.supplier_tax_id = cleanTaxId;
          }
        }
        break;

      case 'total_amount':
      case 'invoice_total':
        if (!extracted.total_amount && normalizedValue?.moneyValue) {
          const amount = parseFloat(normalizedValue.moneyValue.units || '0') + 
                        (normalizedValue.moneyValue.nanos || 0) / 1e9;
          extracted.total_amount = amount;
        }
        break;

      case 'net_amount':
      case 'subtotal':
        if (!extracted.net_amount && normalizedValue?.moneyValue) {
          const amount = parseFloat(normalizedValue.moneyValue.units || '0') + 
                        (normalizedValue.moneyValue.nanos || 0) / 1e9;
          extracted.net_amount = amount;
        }
        break;

      case 'tax_amount':
      case 'vat_amount':
        if (!extracted.tax_amount && normalizedValue?.moneyValue) {
          const amount = parseFloat(normalizedValue.moneyValue.units || '0') + 
                        (normalizedValue.moneyValue.nanos || 0) / 1e9;
          extracted.tax_amount = amount;
        }
        break;

      case 'invoice_date':
      case 'issue_date':
        if (!extracted.issue_date && normalizedValue?.dateValue) {
          const date = normalizedValue.dateValue;
          extracted.issue_date = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        }
        break;

      case 'due_date':
      case 'payment_date':
        if (!extracted.due_date && normalizedValue?.dateValue) {
          const date = normalizedValue.dateValue;
          extracted.due_date = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        }
        break;

      case 'service_address':
      case 'billing_address':
        if (!extracted.service_address && text) {
          extracted.service_address = text;
        }
        break;

      case 'iban':
      case 'bank_account':
        if (!extracted.iban_mask && text) {
          // Mask IBAN for privacy (show first 4 and last 4 chars)
          const cleanIban = text.replace(/\s+/g, '');
          if (cleanIban.length >= 8) {
            extracted.iban_mask = cleanIban.slice(0, 4) + '*'.repeat(cleanIban.length - 8) + cleanIban.slice(-4);
          }
        }
        break;
    }
  }

  // Detect utility type
  const textLower = fullText.toLowerCase();
  const filenameLower = (filename || '').toLowerCase();
  const combinedText = textLower + ' ' + filenameLower;

  for (const [utilityType, patterns] of Object.entries(UTILITY_PATTERNS)) {
    if (patterns.some(pattern => combinedText.includes(pattern.toLowerCase()))) {
      extracted.utility_type = utilityType as any;
      break;
    }
  }

  // Detect reform/construction categories
  if (filename) {
    const reformCategories: any = {};
    let hasReformKeywords = false;

    for (const [category, patterns] of Object.entries(REFORM_PATTERNS)) {
      if (patterns.some(pattern => combinedText.includes(pattern.toLowerCase()))) {
        reformCategories[category] = 1.0; // Default weight
        hasReformKeywords = true;
      }
    }

    if (hasReformKeywords) {
      extracted.categories = reformCategories;
    }
  }

  return extracted;
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    // Validate environment
    const envValidation = validateEnvironment();
    if (!envValidation.isValid) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: envValidation.error
        })
      };
    }

    // Parse request body
    let requestData: OCRRequest;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        })
      };
    }

    // Validate required fields
    if (!requestData.fileBase64 || !requestData.mimeType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: fileBase64, mimeType'
        })
      };
    }

    // Validate file type
    if (!SUPPORTED_TYPES.includes(requestData.mimeType)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: `Unsupported file type: ${requestData.mimeType}. Supported: ${SUPPORTED_TYPES.join(', ')}`
        })
      };
    }

    // Process with Document AI
    console.log('Processing document with Document AI...');
    const documentAIResponse = await processWithDocumentAI(
      requestData.fileBase64,
      requestData.mimeType
    );

    // Extract structured data
    const extractedData = extractStructuredData(documentAIResponse, requestData.filename);

    // Calculate confidence based on extracted fields
    const requiredFields = ['supplier_name', 'total_amount', 'issue_date'];
    const extractedFields = requiredFields.filter(field => extractedData[field as keyof typeof extractedData]);
    const confidence = extractedFields.length / requiredFields.length;

    const response: OCRResponse = {
      success: true,
      data: extractedData,
      confidence
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('OCR processing error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};