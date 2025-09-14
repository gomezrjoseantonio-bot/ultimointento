// FEIN OCR Page Function - Process single pages for OCR to avoid ResponseSizeTooLarge
// Implements lightweight OCR processing per problem statement requirements

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// Types for request/response
interface PageOCRRequest {
  pageImage: string; // Base64 encoded PNG/JPEG
  pageNumber: number;
}

interface PageOCRResponse {
  success: boolean;
  page: number;
  text: string;
  error?: string;
}

// Mock OCR function (replace with real Google Cloud Vision or Tesseract.js)
const performOCR = async (imageBase64: string): Promise<string> => {
  // Simulate OCR processing delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // In production, this would use:
  // - Google Cloud Vision API if GCP_PROJECT & GCP_KEY are available
  // - Tesseract.js as fallback
  
  // Mock OCR response based on image characteristics (for testing)
  const mockTexts = [
    `FICHA EUROPEA DE INFORMACIÓN NORMALIZADA (FEIN)
    PRÉSTAMO HIPOTECARIO VIVIENDA HABITUAL
    
    Entidad: Banco Santander S.A.
    Producto: Hipoteca Vivienda Joven Variable
    
    CONDICIONES FINANCIERAS:
    Capital solicitado: 200.000,00 €
    Plazo: 30 años
    
    Tipo de interés: VARIABLE
    Índice de referencia: EURIBOR 12 meses
    Valor índice actual: 3,684%
    Diferencial aplicable: +0,99%
    TIN resultante: 4,674%
    TAE: 4,78%
    
    Revisión: Anual
    
    CUENTA DE CARGO:
    IBAN: ES91 0049 **** **** **** 1234
    
    BONIFICACIONES APLICABLES:
    - Domiciliación nómina: -0,10 puntos
    - Domiciliación recibos ≥3: -0,05 puntos
    - Seguro hogar: -0,15 puntos
    - Tarjeta crédito: -0,05 puntos
    
    COMISIONES:
    Apertura: 0,00%
    Mantenimiento: 0,00 €/mes
    Amortización anticipada: 0,00%
    `,
    
    `CONDICIONES PARTICULARES DEL PRÉSTAMO
    
    Fecha de firma: 15/02/2024
    Primera cuota: 15/03/2024
    Día de cargo mensual: 15
    
    Sistema de amortización: Francés
    Cuota mensual estimada: 1.047,32 €
    
    SEGUROS VINCULADOS:
    - Seguro hogar obligatorio
    - Seguro vida opcional
    
    GASTOS ADICIONALES:
    Tasación: 400,00 €
    Notaría: 1.200,00 € (aprox.)
    Registro: 300,00 € (aprox.)
    Gestoría: 600,00 € (aprox.)
    
    INFORMACIÓN ADICIONAL:
    - Sin comisión por amortización anticipada
    - Posibilidad de carencia de hasta 12 meses
    - Subrogación permitida sin restricciones
    `,
    
    `TITULAR DEL PRÉSTAMO:
    Juan García López
    DNI: 12345678A
    
    INGRESOS ACREDITADOS:
    Nómina mensual: 3.500,00 €
    Ingresos anuales: 45.500,00 €
    
    RATIOS FINANCIEROS:
    Ratio cuota/ingresos: 29,9%
    Ratio préstamo/valor: 80,0%
    
    PRÓXIMA REVISIÓN:
    Fecha: 15/03/2025
    Índice a aplicar: EURIBOR 12M + 0,99%
    
    Este documento constituye la información 
    precontractual exigida por la normativa europea.
    `
  ];
  
  // Return a realistic mock based on image size
  const imageSize = imageBase64.length;
  const textIndex = Math.floor((imageSize % 1000) / 333); // Pseudo-random based on image
  return mockTexts[textIndex] || mockTexts[0];
};

// Extract request data from event
const extractRequestData = (event: HandlerEvent): PageOCRRequest | null => {
  try {
    if (!event.body) return null;
    
    const body = JSON.parse(event.body);
    
    if (!body.pageImage || typeof body.pageNumber !== 'number') {
      return null;
    }
    
    return {
      pageImage: body.pageImage,
      pageNumber: body.pageNumber
    };
  } catch (error) {
    return null;
  }
};

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.info('FEIN OCR Page Request', { 
    method: event.httpMethod,
    pageNumber: event.body ? JSON.parse(event.body || '{}').pageNumber : undefined
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow POST
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
    // Extract request data
    const requestData = extractRequestData(event);
    if (!requestData) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Datos de solicitud inválidos. Se requiere pageImage y pageNumber.'
        })
      };
    }

    // Validate image size (max 5MB base64)
    if (requestData.pageImage.length > 5 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Imagen demasiado grande. Máximo 5MB.'
        })
      };
    }

    // Perform OCR on the page image
    const extractedText = await performOCR(requestData.pageImage);

    // Ensure text is not too large (max 250KB as per requirements)
    let finalText = extractedText;
    if (finalText.length > 250 * 1024) {
      finalText = finalText.substring(0, 250 * 1024) + '... [texto truncado]';
    }

    // Return compact JSON response
    const response: PageOCRResponse = {
      success: true,
      page: requestData.pageNumber,
      text: finalText
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('FEIN OCR Page Error:', error);
    
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