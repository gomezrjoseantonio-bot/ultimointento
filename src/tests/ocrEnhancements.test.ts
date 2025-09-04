// Enhanced OCR and Invoice Validation Tests for FIX-INBOX requirements
import { processDocumentAIResponse } from '../services/documentAIService';
import { getOCRConfig } from '../services/ocrService';

describe('Enhanced OCR Processing', () => {
  describe('Auto-OCR Configuration', () => {
    test('should default to auto-OCR enabled', () => {
      // Clear localStorage to test default behavior
      localStorage.removeItem('OCR_AUTORUN');
      
      const config = getOCRConfig();
      expect(config.autoRun).toBe(true); // Should default to true
    });

    test('should respect explicit disable setting', () => {
      localStorage.setItem('OCR_AUTORUN', 'false');
      
      const config = getOCRConfig();
      expect(config.autoRun).toBe(false);
      
      // Cleanup
      localStorage.removeItem('OCR_AUTORUN');
    });
  });

  describe('Invoice Validation - Base + VAT ≈ Total', () => {
    test('should add validation warning when totals do not match', () => {
      const mockApiResponse = {
        success: true,
        results: [{
          status: 'success',
          entities: [
            { type: 'net_amount', mentionText: '100.00', confidence: 0.9 },
            { type: 'tax_amount', mentionText: '21.00', confidence: 0.9 },
            { type: 'total_amount', mentionText: '130.00', confidence: 0.9 } // Should be 121.00
          ]
        }]
      };

      const result = processDocumentAIResponse(mockApiResponse, 'test-invoice.pdf');
      
      expect(result.validationWarnings).toBeDefined();
      expect(result.validationWarnings).toHaveLength(1);
      expect(result.validationWarnings![0]).toContain('Totales no cuadran');
      expect(result.validationWarnings![0]).toContain('diferencia: 9.00€');
    });

    test('should not add warnings when totals match within tolerance', () => {
      const mockApiResponse = {
        success: true,
        results: [{
          status: 'success',
          entities: [
            { type: 'net_amount', mentionText: '100.00', confidence: 0.9 },
            { type: 'tax_amount', mentionText: '21.00', confidence: 0.9 },
            { type: 'total_amount', mentionText: '121.00', confidence: 0.9 } // Exact match
          ]
        }]
      };

      const result = processDocumentAIResponse(mockApiResponse, 'test-invoice.pdf');
      
      expect(result.validationWarnings).toEqual([]);
    });

    test('should handle missing amounts gracefully', () => {
      const mockApiResponse = {
        success: true,
        results: [{
          status: 'success',
          entities: [
            { type: 'supplier_name', mentionText: 'ACME Corp', confidence: 0.9 },
            { type: 'invoice_date', mentionText: '2024-01-01', confidence: 0.9 }
            // No amount fields
          ]
        }]
      };

      const result = processDocumentAIResponse(mockApiResponse, 'test-invoice.pdf');
      
      expect(result.validationWarnings).toEqual([]);
      expect(result.status).toBe('completed');
    });

    test('should validate with ±0.01€ tolerance', () => {
      const testCases = [
        { base: 100, tax: 21, total: 121.01, shouldWarn: false }, // Within tolerance
        { base: 100, tax: 21, total: 120.99, shouldWarn: false }, // Within tolerance  
        { base: 100, tax: 21, total: 121.02, shouldWarn: true },  // Outside tolerance
        { base: 100, tax: 21, total: 120.98, shouldWarn: true }   // Outside tolerance
      ];

      testCases.forEach(({ base, tax, total, shouldWarn }) => {
        const mockApiResponse = {
          success: true,
          results: [{
            status: 'success',
            entities: [
              { type: 'net_amount', mentionText: base.toString(), confidence: 0.9 },
              { type: 'tax_amount', mentionText: tax.toString(), confidence: 0.9 },
              { type: 'total_amount', mentionText: total.toString(), confidence: 0.9 }
            ]
          }]
        };

        const result = processDocumentAIResponse(mockApiResponse, 'test-invoice.pdf');
        
        if (shouldWarn) {
          expect(result.validationWarnings?.length).toBeGreaterThan(0);
        } else {
          expect(result.validationWarnings).toEqual([]);
        }
      });
    });
  });

  describe('Field Processing', () => {
    test('should extract common invoice fields', () => {
      const mockApiResponse = {
        success: true,
        results: [{
          status: 'success',
          entities: [
            { type: 'supplier_name', mentionText: 'ENDESA ENERGÍA XXI S.L.U.', confidence: 0.95 },
            { type: 'supplier_tax_id', mentionText: 'B-81948077', confidence: 0.89 },
            { type: 'invoice_id', mentionText: 'FE-2024-001234', confidence: 0.92 },
            { type: 'total_amount', mentionText: '149.32', confidence: 0.87 }
          ]
        }]
      };

      const result = processDocumentAIResponse(mockApiResponse, 'endesa-invoice.pdf');
      
      expect(result.fields).toHaveLength(4);
      expect(result.fields.find(f => f.name === 'supplier_name')?.value).toBe('ENDESA ENERGÍA XXI S.L.U.');
      expect(result.fields.find(f => f.name === 'supplier_tax_id')?.value).toBe('B-81948077');
      expect(result.fields.find(f => f.name === 'invoice_id')?.value).toBe('FE-2024-001234');
      expect(result.fields.find(f => f.name === 'total_amount')?.value).toBe('149.32');
    });
  });
});