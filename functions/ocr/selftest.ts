// H-OCR-SELFTEST: Netlify Function for OCR Configuration Validation
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface SelfTestResponse {
  ok: boolean;
  endpointHost?: string;
  processorPath?: string;
  code?: string;
  message?: string;
}

// H-OCR-SELFTEST: Validate environment configuration for OCR
const validateOCREnvironment = (): SelfTestResponse => {
  // Required environment variables
  const requiredVars = {
    DOC_AI_SA_JSON_B64: process.env.DOC_AI_SA_JSON_B64,
    DOC_AI_PROJECT_ID: process.env.DOC_AI_PROJECT_ID,
    DOC_AI_LOCATION: process.env.DOC_AI_LOCATION,
    DOC_AI_PROCESSOR_ID: process.env.DOC_AI_PROCESSOR_ID,
    DOC_AI_ENDPOINT: process.env.DOC_AI_ENDPOINT
  };

  // Check for missing variables
  const missing = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return {
      ok: false,
      code: "CONFIG",
      message: "OCR: configuración incompleta"
    };
  }

  // Validate DOC_AI_PROJECT_ID is a number
  const projectId = requiredVars.DOC_AI_PROJECT_ID!;
  if (isNaN(Number(projectId))) {
    return {
      ok: false,
      code: "CONFIG",
      message: "OCR: configuración incompleta"
    };
  }

  // Validate DOC_AI_LOCATION is 'eu'
  if (requiredVars.DOC_AI_LOCATION !== 'eu') {
    return {
      ok: false,
      code: "CONFIG",
      message: "OCR: configuración incompleta"
    };
  }

  // Validate DOC_AI_ENDPOINT is the EU endpoint
  const expectedEndpoint = 'eu-documentai.googleapis.com';
  if (requiredVars.DOC_AI_ENDPOINT !== expectedEndpoint) {
    return {
      ok: false,
      code: "CONFIG",
      message: "OCR: configuración incompleta"
    };
  }

  // Construct processor path
  const processorPath = `projects/${projectId}/locations/${requiredVars.DOC_AI_LOCATION}/processors/${requiredVars.DOC_AI_PROCESSOR_ID}:process`;

  // Blind logging - no secrets exposed
  const hasKey = !!requiredVars.DOC_AI_SA_JSON_B64;
  const projectIsNumber = !isNaN(Number(projectId));
  const processorIdLen = requiredVars.DOC_AI_PROCESSOR_ID?.length || 0;

  console.log('OCR Self-Test Validation:', {
    hasKey,
    projectIsNumber,
    processorIdLen,
    location: requiredVars.DOC_AI_LOCATION,
    endpointHost: expectedEndpoint
  });

  return {
    ok: true,
    endpointHost: process.env.DOC_AI_ENDPOINT,
    processorPath
  };
};

// H-OCR-SELFTEST: Main handler function
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  console.log('OCR Self-Test initiated:', {
    method: event.httpMethod,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate OCR environment configuration
    const validationResult = validateOCREnvironment();

    const statusCode = validationResult.ok ? 200 : 400;

    return {
      statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validationResult, null, 2)
    };

  } catch (error) {
    console.error('OCR Self-Test Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: false,
        code: "ERROR",
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }, null, 2)
    };
  }
};