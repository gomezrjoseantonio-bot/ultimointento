// E2E Tests for ocr-fein.ts
// Tests the complete FEIN processing pipeline with real DocAI integration

import { handler } from '../../../functions/ocr-fein';

// Mock the normalize-docai module
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
    byField: {
      capital_inicial: { confidence: 0.90, source: 'docai:loan_amount' },
      plazoMeses: { confidence: 0.85, source: 'docai:term_months' },
      tin: { confidence: 0.88, source: 'docai:interest_rate' },
      tae: { confidence: 0.86, source: 'docai:apr' },
      cuota: { confidence: 0.82, source: 'docai:monthly_payment' }
    },
    confidenceGlobal: 0.87,
    pending: []
  })
}));

// Mock PDF functions
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn().mockResolvedValue({
      getPageCount: jest.fn().mockReturnValue(5) // Mock 5 pages for tests
    }),
    create: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([]),
      addPage: jest.fn(),
      save: jest.fn().mockResolvedValue(new Uint8Array())
    })
  }
}));

// Mock the documentai client for fallback scenarios
jest.mock('../../../src/services/documentaiClient', () => ({
  processWithDocAI: jest.fn().mockResolvedValue({
    success: true,
    results: [{
      status: 'success',
      entities: [
        { type: 'loan_amount', mentionText: '250000.00', confidence: 0.90 },
        { type: 'term_months', mentionText: '300', confidence: 0.85 },
        { type: 'interest_rate', mentionText: '3.25%', confidence: 0.88 },
        { type: 'apr', mentionText: '3.41%', confidence: 0.86 },
        { type: 'monthly_payment', mentionText: '1263.45', confidence: 0.82 }
      ],
      text: 'FEIN Document Content...'
    }]
  })
}));

// Mock fetch for ocr-documentai calls
global.fetch = jest.fn();

describe('ocr-fein E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variables for tests - with deployment URL for absolute endpoint
    process.env.URL = 'https://test-deployment.netlify.app';
    // Clear old env var that's no longer used
    delete process.env.NETLIFY_FUNCTIONS_URL;
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        headers: {},
        body: null,
        isBase64Encoded: false,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      });
    });

    it('should reject non-POST methods', async () => {
      const event = {
        httpMethod: 'GET',
        headers: {},
        body: null,
        isBase64Encoded: false,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Método no permitido');
    });
  });

  describe('File validation', () => {
    it('should reject requests without file', async () => {
      const event = {
        httpMethod: 'POST',
        headers: {},
        body: null,
        isBase64Encoded: false,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Archivo PDF requerido');
    });

    it('should reject files larger than 8MB', async () => {
      // Create a large base64 string (simulating > 8MB file)
      const largeContent = 'A'.repeat(12 * 1024 * 1024); // 12MB in base64
      const largeBase64 = Buffer.from(largeContent).toString('base64');

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: largeBase64,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(413);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Archivo demasiado grande (máx. 8 MB)');
    });

    it('should accept application/pdf content type', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock successful DocAI response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [{
            entities: [
              { type: 'loan_amount', mentionText: '250000', confidence: 0.90 }
            ],
            text: 'FEIN document text',
            pages: []
          }]
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.providerUsed).toBe('docai');
    });

    it('should accept application/octet-stream content type', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock successful DocAI response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [{
            entities: [
              { type: 'loan_amount', mentionText: '250000', confidence: 0.90 }
            ],
            text: 'FEIN document text',
            pages: []
          }]
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/octet-stream'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.providerUsed).toBe('docai');
    });
  });

  describe('DocAI integration', () => {
    it('should successfully process FEIN with DocAI and return normalized fields', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock successful DocAI response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [{
            entities: [
              { type: 'loan_amount', mentionText: '250000.00', confidence: 0.90 },
              { type: 'term_months', mentionText: '300', confidence: 0.85 },
              { type: 'interest_rate', mentionText: '3.25%', confidence: 0.88 },
              { type: 'apr', mentionText: '3.41%', confidence: 0.86 },
              { type: 'monthly_payment', mentionText: '1263.45', confidence: 0.82 }
            ],
            text: 'FEIN document with loan details',
            pages: [{ pageNumber: 1 }]
          }]
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      });

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        providerUsed: 'docai',
        docId: expect.stringMatching(/^fein_\d+_[a-z0-9]{6}$/),
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
      });

      // Verify DocAI was called with correct parameters
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8888/.netlify/functions/ocr-documentai',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf'
          }
        })
      );
    });

    it('should handle DocAI errors gracefully', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock DocAI error response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: {
            message: 'Invalid document format'
          }
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(502);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Error procesando documento con OCR');
    });

    it('should handle empty DocAI results', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock DocAI response with no results
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          results: []
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(502);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Error procesando documento con OCR');
    });
  });

  describe('Response format validation', () => {
    it('should ensure response size is under 100KB', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock successful DocAI response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [{
            entities: [
              { type: 'loan_amount', mentionText: '250000', confidence: 0.90 }
            ],
            text: 'FEIN document text',
            pages: []
          }]
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      
      // Check response size is under 100KB
      const responseSize = JSON.stringify(result.body).length;
      expect(responseSize).toBeLessThan(100 * 1024);
    });

    it('should include all required response fields', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock successful DocAI response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: [{
            entities: [
              { type: 'loan_amount', mentionText: '250000', confidence: 0.90 }
            ],
            text: 'FEIN document text',
            pages: []
          }]
        })
      });

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      // Verify required response structure
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('providerUsed', 'docai');
      expect(body).toHaveProperty('docId');
      expect(body).toHaveProperty('fields');
      expect(body).toHaveProperty('confidenceGlobal');
      expect(body).toHaveProperty('pending');
      
      expect(typeof body.docId).toBe('string');
      expect(typeof body.fields).toBe('object');
      expect(typeof body.confidenceGlobal).toBe('number');
      expect(Array.isArray(body.pending)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle network errors to DocAI', async () => {
      const mockPdfContent = Buffer.from('PDF content here').toString('base64');
      
      // Mock network error
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const event = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/pdf'
        },
        body: mockPdfContent,
        isBase64Encoded: true,
        path: '/.netlify/functions/ocr-fein',
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {}
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Error interno del servidor');
    });
  });
});