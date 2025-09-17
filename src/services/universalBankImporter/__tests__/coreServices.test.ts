/**
 * Unit tests for Universal Bank Importer core services
 */

import { localeDetector } from '../localeDetector';
import { dateFormatDetector } from '../dateFormatDetector';
import { signDerivationService } from '../signDerivationService';

describe('Universal Bank Importer - Core Services', () => {
  
  describe('LocaleDetector', () => {
    test('detectLocaleNumber - Spanish format (comma decimal)', () => {
      const samples = ['1.234,56', '567,89', '12.000,00', '-38,69'];
      const result = localeDetector.detectLocaleNumber(samples);
      
      expect(result.decimalSep).toBe(',');
      expect(result.thousandSep).toBe('.');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('detectLocaleNumber - Anglo format (dot decimal)', () => {
      const samples = ['1,234.56', '567.89', '12,000.00', '-38.69'];
      const result = localeDetector.detectLocaleNumber(samples);
      
      expect(result.decimalSep).toBe('.');
      expect(result.thousandSep).toBe(',');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('parseImporte - Spanish format', () => {
      const locale = { decimalSep: ',' as const, thousandSep: '.' as const, confidence: 0.9, samples: [] };
      const result = localeDetector.parseImporte('1.234,56', locale);
      
      expect(result.value).toBe(1234.56);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('parseImporte - Negative amount', () => {
      const locale = { decimalSep: ',' as const, thousandSep: '.' as const, confidence: 0.9, samples: [] };
      const result = localeDetector.parseImporte('-38,69', locale);
      
      expect(result.value).toBe(-38.69);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('parseImporte - Edge case: 8,00', () => {
      const locale = { decimalSep: ',' as const, thousandSep: '.' as const, confidence: 0.9, samples: [] };
      const result = localeDetector.parseImporte('8,00', locale);
      
      expect(result.value).toBe(8.00);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('DateFormatDetector', () => {
    test('detectDateFormat - Spanish DD/MM/YYYY', () => {
      const samples = ['15/03/2024', '02/01/2024', '28/12/2023'];
      const result = dateFormatDetector.detectDateFormat(samples);
      
      expect(result.format).toBe('DD/MM/YYYY');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('detectDateFormat - ISO YYYY-MM-DD', () => {
      const samples = ['2024-03-15', '2024-01-02', '2023-12-28'];
      const result = dateFormatDetector.detectDateFormat(samples);
      
      expect(result.format).toBe('YYYY-MM-DD');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('parseDate - Spanish format', () => {
      const result = dateFormatDetector.parseDate('15/03/2024');
      
      expect(result).not.toBeNull();
      expect(result!.date.getFullYear()).toBe(2024);
      expect(result!.date.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(result!.date.getDate()).toBe(15);
    });

    test('parseDate - Various formats with hour', () => {
      const dates = [
        '15/03/2024 14:30',
        '2024-03-15T14:30:00',
        '15-03-24'
      ];

      dates.forEach(dateStr => {
        const result = dateFormatDetector.parseDate(dateStr.split(' ')[0].split('T')[0]);
        expect(result).not.toBeNull();
      });
    });
  });

  describe('SignDerivationService', () => {
    const spanishLocale = { 
      decimalSep: ',' as const, 
      thousandSep: '.' as const, 
      confidence: 0.9, 
      samples: [] 
    };

    test('deriveSignedAmount - Debit/Credit columns', () => {
      // Test debit (cargo) - should be negative
      const debitResult = signDerivationService.deriveSignedAmount(
        { debit: '100,50', credit: '' },
        spanishLocale
      );
      
      expect(debitResult.amount).toBe(-100.50);
      expect(debitResult.method).toBe('debit_credit');
      expect(debitResult.confidence).toBeGreaterThan(0.8);

      // Test credit (abono) - should be positive  
      const creditResult = signDerivationService.deriveSignedAmount(
        { debit: '', credit: '250,75' },
        spanishLocale
      );
      
      expect(creditResult.amount).toBe(250.75);
      expect(creditResult.method).toBe('debit_credit');
      expect(creditResult.confidence).toBeGreaterThan(0.8);
    });

    test('deriveSignedAmount - Signed amount column', () => {
      // Positive amount
      const positiveResult = signDerivationService.deriveSignedAmount(
        { amount: '100,50' },
        spanishLocale
      );
      
      expect(positiveResult.amount).toBe(100.50);
      expect(positiveResult.method).toBe('signed_amount');

      // Negative amount
      const negativeResult = signDerivationService.deriveSignedAmount(
        { amount: '-38,69' },
        spanishLocale
      );
      
      expect(negativeResult.amount).toBe(-38.69);
      expect(negativeResult.method).toBe('signed_amount');
    });

    test('deriveSignedAmount - Never derive sign from text', () => {
      // Even with text that might suggest sign, only use numeric data
      const result = signDerivationService.deriveSignedAmount(
        { amount: '100,50' }, // Positive number
        spanishLocale
      );
      
      // Should be positive based on the number, not any text description
      expect(result.amount).toBe(100.50);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('validateSignDerivation - Edge cases', () => {
      // Zero amount
      const zeroResult = signDerivationService.deriveSignedAmount(
        { amount: '0,00' },
        spanishLocale
      );
      const zeroValidation = signDerivationService.validateSignDerivation(zeroResult);
      expect(zeroValidation.warnings).toContain('Zero amount detected');

      // Very large amount
      const largeResult = signDerivationService.deriveSignedAmount(
        { amount: '2.000.000,00' },
        spanishLocale
      );
      const largeValidation = signDerivationService.validateSignDerivation(largeResult);
      expect(largeValidation.warnings).toContain('Very large amount detected, please verify');
    });
  });

  describe('Integration tests', () => {
    test('Full pipeline - Spanish bank data', () => {
      // Simulate typical Spanish bank export data
      const sampleData = [
        ['15/03/2024', 'TRANSFERENCIA RECIBIDA', '', '1.250,00', '5.678,90'],
        ['16/03/2024', 'COMPRA SUPERMERCADO', '38,69', '', '5.640,21'],
        ['17/03/2024', 'NOMINA EMPRESA', '', '2.500,00', '8.140,21']
      ];

      const spanishLocale = { 
        decimalSep: ',' as const, 
        thousandSep: '.' as const, 
        confidence: 0.9, 
        samples: [] 
      };

      sampleData.forEach(row => {
        // Parse date (column 0)
        const dateResult = dateFormatDetector.parseDate(row[0]);
        expect(dateResult).not.toBeNull();
        expect(dateResult!.confidence).toBeGreaterThan(0.8);

        // Parse amounts (debit in column 2, credit in column 3)
        const signResult = signDerivationService.deriveSignedAmount(
          { debit: row[2], credit: row[3] },
          spanishLocale
        );
        expect(signResult.confidence).toBeGreaterThan(0.8);
        
        // Validate sign logic
        if (row[2] && !row[3]) { // Debit only
          expect(signResult.amount).toBeLessThan(0);
        } else if (!row[2] && row[3]) { // Credit only  
          expect(signResult.amount).toBeGreaterThan(0);
        }
      });
    });

    test('Edge case handling - Mixed formats', () => {
      // Test various number representations
      const testCases = [
        { input: '1.234,56', expected: 1234.56 },
        { input: '-38,69', expected: -38.69 },
        { input: '8,00', expected: 8.00 },
        { input: '1.000', expected: 1000 }, // Thousands without decimal
        { input: '500', expected: 500 }      // Plain integer
      ];

      const locale = localeDetector.detectLocaleNumber(testCases.map(t => t.input));
      
      testCases.forEach(testCase => {
        const result = localeDetector.parseImporte(testCase.input, locale);
        expect(result.value).toBeCloseTo(testCase.expected, 2);
      });
    });
  });
});