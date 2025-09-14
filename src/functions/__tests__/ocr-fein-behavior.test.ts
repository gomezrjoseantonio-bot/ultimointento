// Manual test to verify ocr-fein behavior with mocked scenarios
// This tests the actual function behavior

import { handler } from '../../../functions/ocr-fein';

// Mock the dependencies
jest.mock('../../../src/services/ocr/normalize-docai', () => ({
  normalizeFeinFromDocAI: jest.fn().mockReturnValue({
    fields: {
      capital_inicial: '250.000,00 €',
      plazoMeses: 300,
      tin: '3,25 %',
      tae: '3,41 %',
      cuota: '1263,45 €',
      sistemaAmortizacion: 'Francés',
      indice: 'Euríbor 12M',
      diferencial: '+1,50 %'
    },
    confidenceGlobal: 0.87,
    pending: []
  })
}));

jest.mock('../../../src/services/documentaiClient', () => ({
  processWithDocAI: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

// Import the mocked module 
const { processWithDocAI } = require('../../../src/services/documentaiClient');

describe('ocr-fein integration tests', () => {
  const mockPdfContent = Buffer.from('PDF content here').toString('base64');
  const mockPdfBinary = Buffer.from('PDF content here').toString('binary'); // Raw binary for the event body
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Set deployment URL for testing
    process.env.URL = 'https://test-deployment.netlify.app';
  });

  afterEach(() => {
    delete process.env.URL;
  });

  const createTestEvent = (body: string) => ({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/pdf' },
    body,
    isBase64Encoded: false,
    path: '/.netlify/functions/ocr-fein',
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    multiValueHeaders: {},
    rawUrl: 'https://test.netlify.app/.netlify/functions/ocr-fein',
    rawQuery: ''
  });

  test('should use absolute URL when deployment URL is available', async () => {
    // Mock successful function endpoint call
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        results: [{
          status: 'success',
          entities: [
            { type: 'loan_amount', mentionText: '250000.00', confidence: 0.90 }
          ],
          text: 'FEIN content'
        }]
      })
    });

    const event = createTestEvent(mockPdfBinary);
    const result = await handler(event, {} as any);

    // Verify the function was called with absolute URL
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-deployment.netlify.app/.netlify/functions/ocr-documentai',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' }
      })
    );

    // Verify success response
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: expect.stringContaining('"success":true')
    });

    const body = JSON.parse(result.body);
    expect(body.providerUsed).toBe('docai'); // Not fallback
  });

  test('should fallback to direct DocAI when function endpoint fails', async () => {
    // Mock failed function endpoint call
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    // Mock successful direct DocAI call
    (processWithDocAI as jest.Mock).mockResolvedValueOnce({
      success: true,
      results: [{
        status: 'success',
        entities: [
          { type: 'loan_amount', mentionText: '250000.00', confidence: 0.90 }
        ],
        text: 'FEIN content'
      }]
    });

    const event = createTestEvent(mockPdfContent);
    const result = await handler(event, {} as any);

    // Verify function endpoint was tried first
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-deployment.netlify.app/.netlify/functions/ocr-documentai',
      expect.any(Object)
    );

    // Verify fallback was used
    expect(processWithDocAI).toHaveBeenCalledWith({
      base64: mockPdfContent,
      mime: 'application/pdf'
    });

    // Verify success response with fallback indicator
    expect(result).toEqual({
      statusCode: 200,
      headers: expect.any(Object),
      body: expect.stringContaining('"success":true')
    });

    const body = JSON.parse(result.body);
    expect(body.providerUsed).toBe('docai-direct'); // Fallback used
  });

  test('should return 502 when both endpoint and fallback fail', async () => {
    // Mock failed function endpoint call
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    // Mock failed direct DocAI call
    (processWithDocAI as jest.Mock).mockResolvedValueOnce({
      success: false,
      results: [{
        status: 'error',
        error: 'DocAI authentication failed',
        entities: [],
        pages: []
      }]
    });

    const event = createTestEvent(mockPdfContent);
    const result = await handler(event, {} as any);

    // Verify both were attempted
    expect(global.fetch).toHaveBeenCalled();
    expect(processWithDocAI).toHaveBeenCalled();

    // Verify 502 error response
    expect(result).toEqual({
      statusCode: 502,
      headers: expect.any(Object),
      body: JSON.stringify({
        success: false,
        error: 'No se pudo contactar con el servicio de OCR (DocAI)'
      })
    });
  });

  test('should handle missing deployment URL gracefully', async () => {
    // Remove deployment URL
    delete process.env.URL;

    // Mock successful call with relative URL (fallback)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        results: [{
          status: 'success',
          entities: [
            { type: 'loan_amount', mentionText: '250000.00', confidence: 0.90 }
          ],
          text: 'FEIN content'
        }]
      })
    });

    const event = createTestEvent(mockPdfContent);
    const result = await handler(event, {} as any);

    // Verify function was called with relative URL (fallback)
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/ocr-documentai',
      expect.objectContaining({
        method: 'POST'
      })
    );

    expect(result.statusCode).toBe(200);
  });
});