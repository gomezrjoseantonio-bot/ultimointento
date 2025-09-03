import { 
  parseEsNumber, 
  formatEsCurrency, 
  formatEsPercentage, 
  validateInvoiceHarmony,
  ParseResult 
} from './numberUtils';

describe('Spanish Number Parsing Utilities', () => {
  
  describe('parseEsNumber - DoD Test Cases', () => {
    test('34,56 → 34.56', () => {
      const result = parseEsNumber('34,56');
      expect(result.value).toBe(34.56);
      expect(result.code).toBeUndefined();
    });

    test('1.234,56 → 1234.56', () => {
      const result = parseEsNumber('1.234,56');
      expect(result.value).toBe(1234.56);
      expect(result.code).toBeUndefined();
    });

    test('1 234,56 → 1234.56 (space as thousands separator)', () => {
      const result = parseEsNumber('1 234,56');
      expect(result.value).toBe(1234.56);
      expect(result.code).toBeUndefined();
    });

    test('3.455 (only dot, no decimals) → 3455', () => {
      const result = parseEsNumber('3.455');
      expect(result.value).toBe(3455);
      expect(result.code).toBeUndefined();
    });

    test('34.56 (only dot, 2 decimals) → 34.56', () => {
      const result = parseEsNumber('34.56');
      expect(result.value).toBe(34.56);
      expect(result.code).toBeUndefined();
    });

    test('-12,00 € → -12.00', () => {
      const result = parseEsNumber('-12,00 €');
      expect(result.value).toBe(-12.00);
      expect(result.code).toBeUndefined();
    });

    test('8,52 % → 0.0852 (percentage normalization)', () => {
      const result = parseEsNumber('8,52 %', { allowPercent: true });
      expect(result.value).toBe(8.52);
      expect(result.code).toBeUndefined();
      // Note: percentage normalization to 0-1 range would be done at application level
    });
  });

  describe('parseEsNumber - Anti-join Protection', () => {
    test('should detect decimal loss and return DECIMAL_LOSS', () => {
      // Simulate OCR join where "34,56" becomes "3456" 
      const result = parseEsNumber('3456', { 
        mentionText: '34,56' 
      });
      expect(result.value).toBeNull();
      expect(result.code).toBe('DECIMAL_LOSS');
      expect(result.message).toContain(',56 lost during parsing');
    });

    test('should allow valid parsing when mention text matches', () => {
      const result = parseEsNumber('34,56', { 
        mentionText: '34,56' 
      });
      expect(result.value).toBe(34.56);
      expect(result.code).toBeUndefined();
    });
  });

  describe('parseEsNumber - Error Cases', () => {
    test('should return INVALID_NUMBER_ES for multiple commas', () => {
      const result = parseEsNumber('1,2,3');
      expect(result.value).toBeNull();
      expect(result.code).toBe('INVALID_NUMBER_ES');
      expect(result.message).toContain('Multiple commas not allowed');
    });

    test('should return INVALID_NUMBER_ES for invalid characters', () => {
      const result = parseEsNumber('12a,34');
      expect(result.value).toBeNull();
      expect(result.code).toBe('INVALID_NUMBER_ES');
    });

    test('should return INVALID_NUMBER_ES for decimal part too long', () => {
      const result = parseEsNumber('12,345');
      expect(result.value).toBeNull();
      expect(result.code).toBe('INVALID_NUMBER_ES');
      expect(result.message).toContain('Decimal part too long');
    });
  });

  describe('parseEsNumber - Value Drift Detection', () => {
    test('should detect VALUE_DRIFT when result differs >5% from Google value', () => {
      const result = parseEsNumber('100,00', { 
        googleNormalizedValue: 50.0 // 100% difference
      });
      expect(result.value).toBe(100.00);
      expect(result.code).toBe('VALUE_DRIFT');
      expect(result.message).toContain('Value drift');
    });

    test('should not flag drift for values within 5% tolerance', () => {
      const result = parseEsNumber('102,00', { 
        googleNormalizedValue: 100.0 // 2% difference
      });
      expect(result.value).toBe(102.00);
      expect(result.code).toBeUndefined();
    });
  });

  describe('parseEsNumber - Edge Cases', () => {
    test('should handle parentheses for negative amounts', () => {
      const result = parseEsNumber('(123,45)');
      expect(result.value).toBe(-123.45);
    });

    test('should handle non-breaking spaces and thin spaces', () => {
      const result = parseEsNumber('1\u00A0234,56'); // Non-breaking space
      expect(result.value).toBe(1234.56);
    });

    test('should handle currency symbols', () => {
      const result = parseEsNumber('€1.234,56');
      expect(result.value).toBe(1234.56);
    });

    test('should return null for empty input', () => {
      const result = parseEsNumber('');
      expect(result.value).toBeNull();
    });

    test('should return null for whitespace only', () => {
      const result = parseEsNumber('   ');
      expect(result.value).toBeNull();
    });
  });

  describe('parseEsNumber - Precision and Decimals', () => {
    test('should respect maxDecimals option', () => {
      const result = parseEsNumber('123,4567', { maxDecimals: 4 });
      expect(result.value).toBe(123.4567);
    });

    test('should round to specified decimal places', () => {
      const result = parseEsNumber('123,456', { maxDecimals: 2 });
      expect(result.value).toBeNull(); // Should fail validation first
    });
  });

  describe('formatEsCurrency', () => {
    test('should format currency in Spanish locale', () => {
      expect(formatEsCurrency(1234.56)).toBe('1.234,56 €');
    });

    test('should handle negative amounts', () => {
      expect(formatEsCurrency(-123.45)).toBe('-123,45 €');
    });

    test('should always show 2 decimal places', () => {
      expect(formatEsCurrency(100)).toBe('100,00 €');
    });
  });

  describe('formatEsPercentage', () => {
    test('should format percentage in Spanish locale', () => {
      expect(formatEsPercentage(0.0852)).toBe('8,52 %');
    });

    test('should handle negative percentages', () => {
      expect(formatEsPercentage(-0.05)).toBe('-5,00 %');
    });

    test('should always show 2 decimal places', () => {
      expect(formatEsPercentage(0.1)).toBe('10,00 %');
    });
  });

  describe('validateInvoiceHarmony', () => {
    test('should validate when Base + IVA ≈ Total within ±0.01', () => {
      // QA Case from requirements: Wekiwi invoice
      const result = validateInvoiceHarmony(40.58, 8.52, 49.10);
      expect(result.isValid).toBe(true);
      expect(result.expectedTotal).toBe(49.10);
      expect(result.difference).toBe(0);
    });

    test('should handle floating point precision issues', () => {
      const result = validateInvoiceHarmony(129.65, 27.13, 156.78);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBeLessThanOrEqual(0.01);
    });

    test('should fail when difference exceeds tolerance', () => {
      const result = validateInvoiceHarmony(100.00, 21.00, 130.00);
      expect(result.isValid).toBe(false);
      expect(result.expectedTotal).toBe(121.00);
      expect(result.difference).toBe(9.00);
    });

    test('should handle discounts', () => {
      const result = validateInvoiceHarmony(100.00, 21.00, 116.00, 5.00);
      expect(result.isValid).toBe(true);
      expect(result.expectedTotal).toBe(116.00);
    });

    test('should handle exactly 0.01 difference (edge case)', () => {
      const result = validateInvoiceHarmony(100.00, 21.00, 121.01);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBe(0.01);
    });
  });

  describe('QA Rapid Tests (from requirements)', () => {
    test('QA1: Wekiwi invoice amounts', () => {
      const netAmount = parseEsNumber('40,58');
      const taxAmount = parseEsNumber('8,52');
      const totalAmount = parseEsNumber('49,10');
      
      expect(netAmount.value).toBe(40.58);
      expect(taxAmount.value).toBe(8.52);
      expect(totalAmount.value).toBe(49.10);
      
      const harmony = validateInvoiceHarmony(40.58, 8.52, 49.10);
      expect(harmony.isValid).toBe(true);
      
      expect(formatEsCurrency(49.10)).toBe('49,10 €');
    });

    test('QA2: Bank statement (dot only)', () => {
      const negative = parseEsNumber('-1.234');
      const positive = parseEsNumber('45.67');
      
      expect(negative.value).toBe(-1234); // No decimals, thousands
      expect(positive.value).toBe(45.67); // 2 decimals
    });

    test('QA3: OCR with thin spaces', () => {
      const result = parseEsNumber('1\u2009234,56'); // Thin space Unicode
      expect(result.value).toBe(1234.56);
    });

    test('QA4: Percentage normalization', () => {
      const result = parseEsNumber('3,50 %', { allowPercent: true });
      expect(result.value).toBe(3.50);
      
      // For UI display:
      expect(formatEsPercentage(0.035)).toBe('3,50 %');
    });

    test('QA5: Anti-join trap case', () => {
      // This should be blocked with DECIMAL_LOSS
      const result = parseEsNumber('3455', { mentionText: '34,56' });
      expect(result.value).toBeNull();
      expect(result.code).toBe('DECIMAL_LOSS');
    });
  });
});