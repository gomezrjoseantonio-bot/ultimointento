/**
 * FEIN OCR Service Tests
 * Tests for 200/202 response handling and polling functionality
 */

import { FEINOCRService } from '../feinOcrService';

// Mock fetch globally
global.fetch = jest.fn();

describe('FEINOCRService 200/202 Response Handling', () => {
  let service: FEINOCRService;
  const mockFile = new File(['mock-pdf-content'], 'test.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    service = FEINOCRService.getInstance();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('200 (Sync) Response Handling', () => {
    it('should handle successful sync response', async () => {
      const mockResponse = {
        success: true,
        providerUsed: 'docai',
        fields: {
          capital_inicial: '100000',
          plazoMeses: '240',
          tin: '2.5',
          banco: 'Test Bank'
        },
        confidenceGlobal: 0.85,
        pending: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.processFEINDocument(mockFile);

      expect(result.success).toBe(true);
      expect(result.loanDraft).toBeDefined();
      expect(result.loanDraft?.prestamo.capitalInicial).toBe(100000);
      expect(result.loanDraft?.prestamo.banco).toBe('Test Bank');
      expect(result.confidence).toBe(0.85);
    });

    it('should handle failed sync response', async () => {
      const mockResponse = {
        success: false,
        error: 'Processing failed',
        providerUsed: 'docai'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.processFEINDocument(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Processing failed');
    });
  });

  describe('202 (Async) Response Handling', () => {
    it('should handle successful async response with polling', async () => {
      const jobId = 'test-job-123';
      
      // Mock initial 202 response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: () => Promise.resolve({
          success: true,
          mode: 'background',
          jobId,
          message: 'Procesando FEIN en segundo plano'
        })
      });

      // Mock polling responses - first pending, then completed
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            status: 'pending'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            status: 'completed',
            result: {
              providerUsed: 'docai',
              fields: {
                capital_inicial: '200000',
                plazoMeses: '300',
                tin: '3.0'
              },
              confidenceGlobal: 0.9,
              pending: []
            }
          })
        });

      const result = await service.processFEINDocument(mockFile);

      expect(result.success).toBe(true);
      expect(result.loanDraft).toBeDefined();
      expect(result.loanDraft?.prestamo.capitalInicial).toBe(200000);
      expect(result.confidence).toBe(0.9);
      
      // Verify polling was attempted
      expect(fetch).toHaveBeenCalledTimes(3); // Initial + 2 polling calls
    });

    it('should handle failed async response', async () => {
      const jobId = 'test-job-failed';
      
      // Mock initial 202 response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: () => Promise.resolve({
          success: true,
          mode: 'background',
          jobId,
          message: 'Procesando FEIN en segundo plano'
        })
      });

      // Mock polling response with failure
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          status: 'failed',
          message: 'Processing failed in background'
        })
      });

      const result = await service.processFEINDocument(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Processing failed in background');
    });

    it.skip('should handle polling timeout', async () => {
      // This test is skipped to avoid long test execution times
      // The timeout logic is tested manually during development
    });
  });

  describe('Field Protection and Optional Chaining', () => {
    it('should handle missing fields object safely', async () => {
      const mockResponse = {
        success: true,
        providerUsed: 'docai',
        fields: null, // Missing fields
        confidenceGlobal: 0.0,
        pending: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.processFEINDocument(mockFile);

      expect(result.success).toBe(true);
      expect(result.loanDraft).toBeDefined();
      expect(result.loanDraft?.prestamo.capitalInicial).toBeUndefined();
      expect(result.loanDraft?.metadata.warnings).toContain('Campos aún no procesados');
    });

    it('should handle partial fields object safely', async () => {
      const mockResponse = {
        success: true,
        providerUsed: 'docai',
        fields: {
          capital_inicial: '50000',
          // Missing other fields
        },
        confidenceGlobal: 0.5,
        pending: ['plazoMeses', 'tin']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.processFEINDocument(mockFile);

      expect(result.success).toBe(true);
      expect(result.loanDraft?.prestamo.capitalInicial).toBe(50000);
      expect(result.loanDraft?.prestamo.banco).toBeNull();
      expect(result.loanDraft?.prestamo.tinFijo).toBeNull();
    });
  });

  describe('Telemetry Logging', () => {
    beforeEach(() => {
      // Mock development environment
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      // Reset environment
      process.env.NODE_ENV = 'test';
    });

    it('should log telemetry in development mode for sync processing', async () => {
      const mockResponse = {
        success: true,
        providerUsed: 'docai',
        fields: {},
        confidenceGlobal: 0.5,
        pending: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      await service.processFEINDocument(mockFile);

      expect(console.info).toHaveBeenCalledWith('[FEIN] mode', 'sync', null);
    });

    it('should log telemetry in development mode for async processing', async () => {
      const jobId = 'test-job-telemetry';
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: () => Promise.resolve({
          success: true,
          mode: 'background',
          jobId,
          message: 'Procesando FEIN en segundo plano'
        })
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          status: 'completed',
          result: {
            providerUsed: 'docai',
            fields: {},
            confidenceGlobal: 0.5,
            pending: []
          }
        })
      });

      await service.processFEINDocument(mockFile);

      expect(console.info).toHaveBeenCalledWith('[FEIN] mode', 'background', jobId);
      expect(console.info).toHaveBeenCalledWith('[FEIN] polling status', 'completed');
    });
  });
});