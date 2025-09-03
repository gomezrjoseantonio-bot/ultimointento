// H-OCR-ALIGN: Tests for OCR Service validation functions
import {
  OCR_ACCEPT_CONFIDENCE,
  validateInvoiceAmounts,
  validateInvoiceDates,
  checkRequiredFieldsForApply,
  selectBestPageForExtraction,
  getApplicableFields
} from './ocrService';
import { OCRResult, OCRField } from './db';

describe('H-OCR-ALIGN OCR Service Tests', () => {
  
  describe('Confidence Threshold', () => {
    test('OCR_ACCEPT_CONFIDENCE should be 0.80', () => {
      expect(OCR_ACCEPT_CONFIDENCE).toBe(0.80);
    });
  });

  describe('Amount Validation (Base + IVA ≈ Total)', () => {
    test('should validate when amounts add up within tolerance', () => {
      const result = validateInvoiceAmounts(129.65, 27.13, 156.78);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBeLessThanOrEqual(0.01);
    });

    test('should fail when amounts do not add up', () => {
      const result = validateInvoiceAmounts(100.00, 21.00, 130.00);
      expect(result.isValid).toBe(false);
      expect(result.difference).toBeGreaterThan(0.01);
      expect(result.expectedTotal).toBe(121.00);
    });

    test('should handle edge case with exactly 0.01 difference', () => {
      const result = validateInvoiceAmounts(100.00, 21.00, 121.01);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBe(0.01);
    });
  });

  describe('Date Validation', () => {
    test('should validate today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = validateInvoiceDates(today);
      expect(result.invoiceDateValid).toBe(true);
      expect(result.dueDateValid).toBe(true);
    });

    test('should reject invoice date more than 5 days in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 6);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const result = validateInvoiceDates(futureDateStr);
      expect(result.invoiceDateValid).toBe(false);
      expect(result.errorMessage).toContain('más de 5 días en el futuro');
    });

    test('should validate due date within 180 days', () => {
      const invoiceDate = '2024-01-15';
      const dueDate = '2024-02-15'; // 31 days later
      
      const result = validateInvoiceDates(invoiceDate, dueDate);
      expect(result.invoiceDateValid).toBe(true);
      expect(result.dueDateValid).toBe(true);
    });

    test('should reject due date before invoice date', () => {
      const invoiceDate = '2024-01-15';
      const dueDate = '2024-01-10'; // 5 days before
      
      const result = validateInvoiceDates(invoiceDate, dueDate);
      expect(result.dueDateValid).toBe(false);
      expect(result.errorMessage).toContain('debe ser >= fecha factura');
    });

    test('should reject due date more than 180 days after invoice', () => {
      const invoiceDate = '2024-01-15';
      const dueDate = '2024-08-15'; // More than 180 days later
      
      const result = validateInvoiceDates(invoiceDate, dueDate);
      expect(result.dueDateValid).toBe(false);
      expect(result.errorMessage).toContain('> 180 días');
    });
  });

  describe('Required Fields Check', () => {
    test('should pass when all required fields are present and valid', () => {
      const ocrFields: OCRField[] = [
        { name: 'total_amount', value: '156.78', confidence: 0.96 },
        { name: 'invoice_date', value: '2024-01-15', confidence: 0.94 },
        { name: 'currency', value: 'EUR', confidence: 0.99 }
      ];
      
      const result = checkRequiredFieldsForApply(ocrFields);
      expect(result.canApply).toBe(true);
      expect(result.hasValidTotal).toBe(true);
      expect(result.hasValidDate).toBe(true);
      expect(result.hasCurrency).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    test('should fail when total_amount confidence is below threshold', () => {
      const ocrFields: OCRField[] = [
        { name: 'total_amount', value: '156.78', confidence: 0.70 }, // Below 0.80
        { name: 'invoice_date', value: '2024-01-15', confidence: 0.94 },
        { name: 'currency', value: 'EUR', confidence: 0.99 }
      ];
      
      const result = checkRequiredFieldsForApply(ocrFields);
      expect(result.canApply).toBe(false);
      expect(result.hasValidTotal).toBe(false);
      expect(result.missingFields).toContain('total_amount');
    });

    test('should fail when invoice_date is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 6);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const ocrFields: OCRField[] = [
        { name: 'total_amount', value: '156.78', confidence: 0.96 },
        { name: 'invoice_date', value: futureDateStr, confidence: 0.94 },
        { name: 'currency', value: 'EUR', confidence: 0.99 }
      ];
      
      const result = checkRequiredFieldsForApply(ocrFields);
      expect(result.canApply).toBe(false);
      expect(result.hasValidDate).toBe(false);
      expect(result.missingFields).toContain('invoice_date válida');
    });
  });

  describe('Page Selection for Multi-Page Documents', () => {
    test('should prioritize page with monetary entities', () => {
      const pages = [
        'Legal terms and conditions...',
        'FACTURA Nº 001 TOTAL: 156,78 € IVA: 27,13 €',
        'Contact information...'
      ];
      
      const ocrFields: OCRField[] = [
        { name: 'total_amount', value: '156.78', confidence: 0.96, page: 2 },
        { name: 'tax_amount', value: '27.13', confidence: 0.91, page: 2 },
        { name: 'supplier_name', value: 'Test Corp', confidence: 0.88, page: 1 }
      ];
      
      const result = selectBestPageForExtraction(pages, ocrFields);
      expect(result.bestPageIndex).toBe(1); // 0-based, so page 2
      expect(result.allScores[1]).toBeGreaterThan(result.allScores[0]);
      expect(result.allScores[1]).toBeGreaterThan(result.allScores[2]);
    });

    test('should handle single page documents', () => {
      const pages = ['Single page content'];
      const result = selectBestPageForExtraction(pages);
      expect(result.bestPageIndex).toBe(0);
      expect(result.allScores).toHaveLength(1);
    });
  });

  describe('Applicable Fields Filtering', () => {
    test('should only return fields above confidence threshold', () => {
      const ocrResult: OCRResult = {
        engine: 'document-ai-invoice',
        timestamp: '2024-01-15T10:00:00Z',
        confidenceGlobal: 0.85,
        status: 'completed',
        fields: [
          { name: 'total_amount', value: '156.78', confidence: 0.96 }, // Above threshold
          { name: 'subtotal', value: '129.65', confidence: 0.75 }, // Below threshold
          { name: 'invoice_date', value: '2024-01-15', confidence: 0.94 }, // Above threshold
          { name: 'supplier_name', value: 'Test Corp', confidence: 0.60 } // Below threshold
        ]
      };
      
      const applicableFields = getApplicableFields(ocrResult);
      expect(applicableFields).toHaveLength(2);
      expect(applicableFields.map(f => f.name)).toEqual(['total_amount', 'invoice_date']);
    });

    test('should exclude blacklisted providers', () => {
      const ocrResult: OCRResult = {
        engine: 'document-ai-invoice',
        timestamp: '2024-01-15T10:00:00Z',
        confidenceGlobal: 0.85,
        status: 'completed',
        fields: [
          { name: 'total_amount', value: '156.78', confidence: 0.96 },
          { name: 'proveedor', value: 'EJEMPLO', confidence: 0.95 } // Blacklisted
        ]
      };
      
      const applicableFields = getApplicableFields(ocrResult);
      expect(applicableFields).toHaveLength(1);
      expect(applicableFields[0].name).toBe('total_amount');
    });
  });

  describe('QA Test Cases (as per requirements)', () => {
    describe('QA Case 1: Simple invoice with subtotal + IVA = total', () => {
      test('should validate and enable Apply button', () => {
        const ocrFields: OCRField[] = [
          { name: 'total_amount', value: '156.78', confidence: 0.96 },
          { name: 'subtotal', value: '129.65', confidence: 0.93 },
          { name: 'tax_amount', value: '27.13', confidence: 0.91 },
          { name: 'invoice_date', value: '2024-01-15', confidence: 0.94 },
          { name: 'currency', value: 'EUR', confidence: 0.99 }
        ];
        
        const requiredCheck = checkRequiredFieldsForApply(ocrFields);
        const amountCheck = validateInvoiceAmounts(129.65, 27.13, 156.78);
        const dateCheck = validateInvoiceDates('2024-01-15');
        
        expect(requiredCheck.canApply).toBe(true);
        expect(amountCheck.isValid).toBe(true);
        expect(dateCheck.invoiceDateValid).toBe(true);
      });
    });

    describe('QA Case 2: Multi-page invoice with total on page 2', () => {
      test('should auto-select page 2 and enable Apply when switched back', () => {
        const pages = [
          'Terms and conditions page',
          'FACTURA TOTAL: 156,78 € SUBTOTAL: 129,65 € IVA: 27,13 €'
        ];
        
        const ocrFields: OCRField[] = [
          { name: 'total_amount', value: '156.78', confidence: 0.96, page: 2 },
          { name: 'subtotal', value: '129.65', confidence: 0.93, page: 2 },
          { name: 'tax_amount', value: '27.13', confidence: 0.91, page: 2 }
        ];
        
        const pageSelection = selectBestPageForExtraction(pages, ocrFields);
        expect(pageSelection.bestPageIndex).toBe(1); // Page 2 (0-based)
        
        // Simulate switching to page 1 - should not have monetary fields
        const page1Fields = ocrFields.filter(f => f.page === 1);
        const page1Check = checkRequiredFieldsForApply(page1Fields);
        expect(page1Check.canApply).toBe(false);
      });
    });

    describe('QA Case 3: Multiple tax_amount lines', () => {
      test('should sum tax amounts only if all meet threshold', () => {
        const ocrFieldsAllHigh: OCRField[] = [
          { name: 'tax_amount', value: '15.00', confidence: 0.95 },
          { name: 'tax_amount', value: '12.13', confidence: 0.89 }
        ];
        
        const ocrFieldsMixed: OCRField[] = [
          { name: 'tax_amount', value: '15.00', confidence: 0.95 },
          { name: 'tax_amount', value: '12.13', confidence: 0.70 } // Below threshold
        ];
        
        const applicableHigh = getApplicableFields({
          engine: 'test',
          timestamp: '2024-01-15T10:00:00Z',
          confidenceGlobal: 0.85,
          status: 'completed',
          fields: ocrFieldsAllHigh
        });
        
        const applicableMixed = getApplicableFields({
          engine: 'test',
          timestamp: '2024-01-15T10:00:00Z',
          confidenceGlobal: 0.85,
          status: 'completed',
          fields: ocrFieldsMixed
        });
        
        expect(applicableHigh).toHaveLength(2); // Both tax amounts included
        expect(applicableMixed).toHaveLength(1); // Only high confidence one
      });
    });
  });
});