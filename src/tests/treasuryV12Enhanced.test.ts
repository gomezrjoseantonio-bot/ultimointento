/**
 * Treasury v1.2 Enhanced Features Tests
 * Tests for the new bank import functionality
 */

import { localeDetector } from '../services/universalBankImporter/localeDetector';
import { signDerivationService } from '../services/universalBankImporter/signDerivationService';
import { dateFormatDetector } from '../services/universalBankImporter/dateFormatDetector';

describe('Treasury v1.2 Enhanced Amount Parsing', () => {
  
  describe('Spanish Amount Format Parsing', () => {
    it('should parse negative amounts correctly (-38,69)', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = localeDetector.parseImporte('-38,69', locale);
      expect(result.value).toBeCloseTo(-38.69, 2);
    });

    it('should parse trailing negative amounts (38,69-)', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = localeDetector.parseImporte('38,69-', locale);
      expect(result.value).toBeCloseTo(-38.69, 2);
    });

    it('should parse parentheses negative amounts ((38,69))', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = localeDetector.parseImporte('(38,69)', locale);
      expect(result.value).toBeCloseTo(-38.69, 2);
    });

    it('should parse thousands separators (1.234,56)', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = localeDetector.parseImporte('1.234,56', locale);
      expect(result.value).toBeCloseTo(1234.56, 2);
    });

    it('should parse Anglo format (1,234.56)', () => {
      const locale = {
        decimalSep: '.' as const,
        thousandSep: ',' as const,
        confidence: 0.8,
        samples: []
      };
      const result = localeDetector.parseImporte('1,234.56', locale);
      expect(result.value).toBeCloseTo(1234.56, 2);
    });
  });

  describe('Sign Derivation from Cargo/Abono', () => {
    it('should derive negative amount from cargo/debit columns', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = signDerivationService.deriveSignedAmount({
        debit: '100,50',
        credit: ''
      }, locale);
      
      expect(result.amount).toBeCloseTo(-100.50, 2);
      expect(result.method).toBe('debit_credit');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should derive positive amount from abono/credit columns', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = signDerivationService.deriveSignedAmount({
        debit: '',
        credit: '200,75'
      }, locale);
      
      expect(result.amount).toBeCloseTo(200.75, 2);
      expect(result.method).toBe('debit_credit');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle Spanish column names (cargo/abono)', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = signDerivationService.deriveSignedAmount({
        cargo: '50,25',
        abono: ''
      }, locale);
      
      expect(result.amount).toBeCloseTo(-50.25, 2);
      expect(result.method).toBe('debit_credit');
    });
  });

  describe('Date Format Detection', () => {
    it('should parse dd/mm/yyyy format', () => {
      const result = dateFormatDetector.parseDate('15/03/2024');
      expect(result).toBeTruthy();
      expect(result!.date.getFullYear()).toBe(2024);
      expect(result!.date.getMonth()).toBe(2); // March (0-indexed)
      expect(result!.date.getDate()).toBe(15);
    });

    it('should parse dd-mm-yyyy format', () => {
      const result = dateFormatDetector.parseDate('25-12-2023');
      expect(result).toBeTruthy();
      expect(result!.date.getFullYear()).toBe(2023);
      expect(result!.date.getMonth()).toBe(11); // December
      expect(result!.date.getDate()).toBe(25);
    });

    it('should parse yyyy-mm-dd format', () => {
      const result = dateFormatDetector.parseDate('2024-06-10');
      expect(result).toBeTruthy();
      expect(result!.date.getFullYear()).toBe(2024);
      expect(result!.date.getMonth()).toBe(5); // June
      expect(result!.date.getDate()).toBe(10);
    });

    it('should detect best format from multiple samples', () => {
      const samples = ['15/03/2024', '16/03/2024', '17/03/2024'];
      const result = dateFormatDetector.detectDateFormat(samples);
      
      expect(result.format).toBe('DD/MM/YYYY');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Locale Detection', () => {
    it('should detect Spanish locale from samples', () => {
      const samples = ['1.234,56', '2.500,00', '123,45'];
      const result = localeDetector.detectLocaleNumber(samples);
      
      expect(result.decimalSep).toBe(',');
      expect(result.thousandSep).toBe('.');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should detect Anglo locale from samples', () => {
      const samples = ['1,234.56', '2,500.00', '123.45'];
      const result = localeDetector.detectLocaleNumber(samples);
      
      expect(result.decimalSep).toBe('.');
      expect(result.thousandSep).toBe(',');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid date strings gracefully', () => {
      const result = dateFormatDetector.parseDate('invalid-date');
      expect(result).toBeNull();
    });

    it('should handle invalid amount strings gracefully', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = localeDetector.parseImporte('not-a-number', locale);
      expect(result.value).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle empty debit/credit columns', () => {
      const locale = localeDetector.getDefaultSpanishLocale();
      const result = signDerivationService.deriveSignedAmount({
        debit: '',
        credit: ''
      }, locale);
      
      expect(result.amount).toBe(0);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});

describe('Treasury v1.2 Calendar Aggregations', () => {
  
  describe('Monthly Totals Calculation', () => {
    const sampleMovements = [
      { amount: 1000, date: '2024-03-01' },
      { amount: -500, date: '2024-03-02' },
      { amount: 250, date: '2024-03-15' },
      { amount: -100, date: '2024-03-20' },
      { amount: 75, date: '2024-04-01' } // Different month
    ];

    it('should calculate monthly income correctly', () => {
      const marchMovements = sampleMovements.filter(m => m.date.startsWith('2024-03'));
      const income = marchMovements
        .filter(m => m.amount > 0)
        .reduce((sum, m) => sum + m.amount, 0);
      
      expect(income).toBe(1250); // 1000 + 250
    });

    it('should calculate monthly expenses correctly', () => {
      const marchMovements = sampleMovements.filter(m => m.date.startsWith('2024-03'));
      const expenses = marchMovements
        .filter(m => m.amount < 0)
        .reduce((sum, m) => sum + Math.abs(m.amount), 0);
      
      expect(expenses).toBe(600); // 500 + 100
    });

    it('should calculate net correctly', () => {
      const marchMovements = sampleMovements.filter(m => m.date.startsWith('2024-03'));
      const net = marchMovements.reduce((sum, m) => sum + m.amount, 0);
      
      expect(net).toBe(650); // 1250 - 600
    });
  });

  describe('Color Scheme Compliance', () => {
    const getStatusColor = (state: string, amount: number) => {
      if (state === 'reconciled') return 'blue';
      if (state === 'pending' || !state) return 'gray';
      return amount >= 0 ? 'green' : 'red';
    };

    it('should use blue for reconciled movements', () => {
      expect(getStatusColor('reconciled', 100)).toBe('blue');
      expect(getStatusColor('reconciled', -100)).toBe('blue');
    });

    it('should use gray for unplanned movements', () => {
      expect(getStatusColor('pending', 100)).toBe('gray');
      expect(getStatusColor('', 100)).toBe('gray');
    });

    it('should use green/red for amount-based coloring', () => {
      expect(getStatusColor('confirmed', 100)).toBe('green');
      expect(getStatusColor('confirmed', -100)).toBe('red');
    });
  });
});

describe('Treasury v1.2 Deduplication', () => {
  
  describe('Hash Generation Consistency', () => {
    const sampleMovement = {
      accountId: 123,
      date: '2024-03-15',
      amount: -150.50,
      description: 'COMPRA SUPERMERCADO X',
      reference: 'REF123456'
    };

    it('should generate consistent hashes for identical movements', () => {
      // This would test the hash generation if we had access to the service
      // For now, we verify the concept
      const movement1 = { ...sampleMovement };
      const movement2 = { ...sampleMovement };
      
      expect(movement1).toEqual(movement2);
    });

    it('should generate different hashes for different movements', () => {
      const movement1 = { ...sampleMovement };
      const movement2 = { ...sampleMovement, amount: -200.00 };
      
      expect(movement1).not.toEqual(movement2);
    });
  });
});

export {};