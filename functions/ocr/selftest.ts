// H-OCR-DIAG: Self-test endpoint for OCR configuration validation
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GoogleAuth } from 'google-auth-library';

// H-OCR-DIAG: Validate environment configuration
const validateEnvironment = (): {
  isValid: boolean;
  missing: string[];
} => {
  const requiredVars = [
    'DOC_AI_SA_JSON_B64',
    'DOC_AI_PROJECT_ID', 
    'DOC_AI_LOCATION',
    'DOC_AI_PROCESSOR_ID',
    'DOC_AI_ENDPOINT'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  return {
    isValid: missing.length === 0,
    missing
  };
};

// H-OCR-DIAG: Test processor reachability
const testProcessorReachability = async (): Promise<{
  reachable: boolean;
  error?: string;
}> => {
  try {
    // Create authenticated client
    const serviceAccountJson = Buffer.from(
      process.env.DOC_AI_SA_JSON_B64!.replace(/\s/g, ''),
      'base64'
    ).toString('utf-8');
    
    const credentials = JSON.parse(serviceAccountJson);
    
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    // Test processor endpoint with HEAD request
    const endpoint = `https://${process.env.DOC_AI_ENDPOINT}`;
    const path = `projects/${process.env.DOC_AI_PROJECT_ID}/locations/${process.env.DOC_AI_LOCATION}/processors/${process.env.DOC_AI_PROCESSOR_ID}:process`;
    
    const response = await fetch(`${endpoint}/v1/${path}`, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`
      }
    });

    // Even if the HEAD request returns 400 (method not allowed), it means the processor exists
    // A 404 would indicate the processor doesn't exist
    return {
      reachable: response.status !== 404 && response.status !== 403
    };

  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

// H-OCR-DIAG: Main selftest handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        ok: false,
        error: 'Método no permitido' 
      })
    };
  }

  try {
    // Check environment variables
    const envCheck = validateEnvironment();
    
    if (!envCheck.isValid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: `Variables de entorno faltantes: ${envCheck.missing.join(', ')}`,
          checks: {
            environment: false,
            processor: false
          }
        })
      };
    }

    // Test processor reachability
    const processorCheck = await testProcessorReachability();
    
    const endpointHost = process.env.DOC_AI_ENDPOINT || 'eu-documentai.googleapis.com';
    const processorPath = `projects/${process.env.DOC_AI_PROJECT_ID}/locations/${process.env.DOC_AI_LOCATION}/processors/${process.env.DOC_AI_PROCESSOR_ID}:process`;

    if (!processorCheck.reachable) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: processorCheck.error || 'Processor no accesible',
          endpointHost,
          processorPath,
          checks: {
            environment: true,
            processor: false
          }
        })
      };
    }

    // All checks passed
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        endpointHost,
        processorPath,
        checks: {
          environment: true,
          processor: true
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Selftest Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: 'Error interno en selftest',
        checks: {
          environment: false,
          processor: false
        }
      })
    };
  }
};