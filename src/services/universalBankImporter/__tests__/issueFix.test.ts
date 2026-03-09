/**
 * Integration test to verify the fix for the issue:
 * "32,18" should be parsed as 32.18 euros (3218 cents), not -321800
 */

import { parseAmountToCents } from '../localeAmount';
import { signDerivationService } from '../signDerivationService';
import { localeDetector } from '../localeDetector';

describe('Issue Fix Verification: 32,18 parsing', () => {
  
  test('parseAmountToCents: "32,18" → 3218 cents (32.18 euros)', () => {
    const result = parseAmountToCents('32,18');
    
    expect(result.ok).toBe(true);
    expect(result.cents).toBe(3218);
    
    // Convert to euros for display
    const euros = result.cents / 100;
    expect(euros).toBe(32.18);
  });

  test('signDerivationService: "32,18" in debit column → -32.18 euros', () => {
    const spanishLocale = { 
      decimalSep: ',' as const, 
      thousandSep: '.' as const, 
      confidence: 0.9, 
      samples: [] 
    };
    
    const result = signDerivationService.deriveSignedAmount(
      { debit: '32,18' },
      spanishLocale
    );
    
    expect(result.amount).toBe(-32.18);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('signDerivationService: "32,18" in credit column → +32.18 euros', () => {
    const spanishLocale = { 
      decimalSep: ',' as const, 
      thousandSep: '.' as const, 
      confidence: 0.9, 
      samples: [] 
    };
    
    const result = signDerivationService.deriveSignedAmount(
      { credit: '32,18' },
      spanishLocale
    );
    
    expect(result.amount).toBe(32.18);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('localeDetector.parseImporte: "32,18" → 32.18 euros', () => {
    const spanishLocale = { 
      decimalSep: ',' as const, 
      thousandSep: '.' as const, 
      confidence: 0.9, 
      samples: [] 
    };
    
    const result = localeDetector.parseImporte('32,18', spanishLocale);
    
    expect(result.value).toBe(32.18);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('BBVA format: "3.218,00-" (suffix minus) → -3218.00 euros', () => {
    const result = parseAmountToCents('3.218,00-');
    
    expect(result.ok).toBe(true);
    expect(result.cents).toBe(-321800);
    
    const euros = result.cents / 100;
    expect(euros).toBe(-3218.00);
  });

  test('Various BBVA-like formats', () => {
    const testCases = [
      { input: '32,18', expected: 3218 },
      { input: '-32,18', expected: -3218 },
      { input: '(32,18)', expected: -3218 },
      { input: '1.234,56', expected: 123456 },
      { input: '€ 1.050,75', expected: 105075 },
      { input: '39.065,00', expected: 3906500 },
      { input: '3.218,00-', expected: -321800 },
    ];
    
    testCases.forEach(({ input, expected }) => {
      const result = parseAmountToCents(input);
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(expected);
    });
  });
});
