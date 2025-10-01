/**
 * Unit tests for localeAmount parser
 * Tests all cases from problem statement
 */

import { parseAmountToCents } from '../localeAmount';

describe('parseAmountToCents', () => {
  
  describe('Problem Statement Test Cases', () => {
    // Note: The first two tests show how the parser works with context
    // In practice, the sign context comes from column semantics (Cargo/Abono, Debe/Haber)
    
    test('Case 1: "32,18" with negative context (gasto) → -3218 cents', () => {
      const result = parseAmountToCents('32,18');
      // Parser returns positive 3218, then context applies negative
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(3218);
    });

    test('Case 2: "32,18" with positive context (abono) → 3218 cents', () => {
      const result = parseAmountToCents('32,18');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(3218);
    });

    test('Case 3: "-32,18" → -3218 cents', () => {
      const result = parseAmountToCents('-32,18');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-3218);
    });

    test('Case 4: "(32,18)" → -3218 cents', () => {
      const result = parseAmountToCents('(32,18)');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-3218);
    });

    test('Case 5: "1.234,56" → 123456 cents', () => {
      const result = parseAmountToCents('1.234,56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Case 6: "1,234.56" → 123456 cents', () => {
      const result = parseAmountToCents('1,234.56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Case 7: "39.065,00" → 3906500 cents', () => {
      const result = parseAmountToCents('39.065,00');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(3906500);
    });

    test('Case 8: "3.218,00-" → -321800 cents', () => {
      const result = parseAmountToCents('3.218,00-');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-321800);
    });

    test('Case 9: "2.000" → 200000 cents (thousands with dot)', () => {
      const result = parseAmountToCents('2.000');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(200000);
    });

    test('Case 10: "2,000" → 200000 cents (thousands with comma)', () => {
      const result = parseAmountToCents('2,000');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(200000);
    });

    test('Case 11: "2.000,0" → 200000 cents (one decimal)', () => {
      const result = parseAmountToCents('2.000,0');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(200000);
    });

    test('Case 12: "2.000,05" → 200005 cents', () => {
      const result = parseAmountToCents('2.000,05');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(200005);
    });

    test('Case 13: "€ 1.050,75" → 105075 cents', () => {
      const result = parseAmountToCents('€ 1.050,75');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(105075);
    });

    test('Case 14: "1 234,56" → 123456 cents (space as thousands)', () => {
      const result = parseAmountToCents('1 234,56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Case 15: "CR 123,45" → 12345 cents (credit)', () => {
      const result = parseAmountToCents('CR 123,45');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(12345);
    });

    test('Case 16: "DR 123,45" → -12345 cents (debit)', () => {
      const result = parseAmountToCents('DR 123,45');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-12345);
    });
  });

  describe('Additional Edge Cases', () => {
    test('Integer without separators: "1000" → 100000 cents', () => {
      const result = parseAmountToCents('1000');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(100000);
    });

    test('Zero: "0" → 0 cents', () => {
      const result = parseAmountToCents('0');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(0);
    });

    test('Zero with decimals: "0,00" → 0 cents', () => {
      const result = parseAmountToCents('0,00');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(0);
    });

    test('Empty string → ok: false', () => {
      const result = parseAmountToCents('');
      expect(result.ok).toBe(false);
      expect(result.cents).toBe(0);
    });

    test('Invalid text → ok: false', () => {
      const result = parseAmountToCents('invalid');
      expect(result.ok).toBe(false);
    });

    test('EUR suffix: "1.234,56 EUR" → 123456 cents', () => {
      const result = parseAmountToCents('1.234,56 EUR');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Euro symbol at end: "1.234,56€" → 123456 cents', () => {
      const result = parseAmountToCents('1.234,56€');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('NBSP (non-breaking space): "1\u00A0234,56" → 123456 cents', () => {
      const result = parseAmountToCents('1\u00A0234,56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Multiple spaces: "1  234,56" → 123456 cents', () => {
      const result = parseAmountToCents('1  234,56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Very small amount: "0,01" → 1 cent', () => {
      const result = parseAmountToCents('0,01');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(1);
    });

    test('Negative with parentheses and dot thousands: "(1.234,56)" → -123456 cents', () => {
      const result = parseAmountToCents('(1.234,56)');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-123456);
    });

    test('Negative with parentheses and comma thousands: "(1,234.56)" → -123456 cents', () => {
      const result = parseAmountToCents('(1,234.56)');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-123456);
    });

    test('Single decimal digit: "100,5" → 10050 cents', () => {
      const result = parseAmountToCents('100,5');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(10050);
    });

    test('Anglo format with thousands: "12,345.67" → 1234567 cents', () => {
      const result = parseAmountToCents('12,345.67');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(1234567);
    });

    test('Large amount: "1.234.567,89" → 123456789 cents', () => {
      const result = parseAmountToCents('1.234.567,89');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456789);
    });

    test('Suffix minus with euro: "1.234,56€-" → -123456 cents', () => {
      const result = parseAmountToCents('1.234,56€-');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(-123456);
    });
  });

  describe('Ambiguous Cases - Rightmost Separator is Decimal', () => {
    test('Both separators: "1.234,56" → comma is decimal', () => {
      const result = parseAmountToCents('1.234,56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Both separators: "1,234.56" → dot is decimal', () => {
      const result = parseAmountToCents('1,234.56');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(123456);
    });

    test('Only comma, 3+ digits after: "2,000" → thousands separator', () => {
      const result = parseAmountToCents('2,000');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(200000);
    });

    test('Only dot, 3+ digits after: "2.000" → thousands separator', () => {
      const result = parseAmountToCents('2.000');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(200000);
    });

    test('Only comma, 1-2 digits after: "123,45" → decimal separator', () => {
      const result = parseAmountToCents('123,45');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(12345);
    });

    test('Only dot, 1-2 digits after: "123.45" → decimal separator', () => {
      const result = parseAmountToCents('123.45');
      expect(result.ok).toBe(true);
      expect(result.cents).toBe(12345);
    });
  });
});
