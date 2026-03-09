/**
 * Tests for safe utility functions
 * Validates that .match() errors on undefined values are fixed
 */
import { safeMatch, asString, safeText, safeIncludes } from '../utils/safe';

describe('Safe Utility Functions', () => {
  describe('safeMatch', () => {
    it('should handle undefined values without throwing', () => {
      expect(safeMatch(undefined, /test/)).toBeNull();
      expect(safeMatch(null, /test/)).toBeNull();
      expect(safeMatch('', /test/)).toBeNull();
    });

    it('should work with valid strings', () => {
      const result = safeMatch('test string', /test/);
      expect(result).not.toBeNull();
      expect(result![0]).toBe('test');
    });

    it('should handle IBAN patterns like in bank parser', () => {
      const ibanText = 'ES9121000418450200051332';
      const ibanPattern = /ES\d{22}/g;
      
      const result = safeMatch(ibanText, ibanPattern);
      expect(result).not.toBeNull();
      expect(result![0]).toBe('ES9121000418450200051332');
      
      // Test with undefined (this would throw before the fix)
      const undefinedResult = safeMatch(undefined, ibanPattern);
      expect(undefinedResult).toBeNull();
    });
  });

  describe('asString', () => {
    it('should convert various types to string safely', () => {
      expect(asString(undefined)).toBe('');
      expect(asString(null)).toBe('');
      expect(asString('hello')).toBe('hello');
      expect(asString(123)).toBe('123');
      expect(asString(true)).toBe('true');
    });
  });

  describe('safeText', () => {
    it('should return trimmed text or empty string', () => {
      expect(safeText('  hello  ')).toBe('hello');
      expect(safeText(undefined)).toBe('');
      expect(safeText(null)).toBe('');
    });
  });

  describe('safeIncludes', () => {
    it('should check for substring safely', () => {
      expect(safeIncludes('hello world', 'world')).toBe(true);
      expect(safeIncludes('hello world', 'WORLD')).toBe(true); // case insensitive
      expect(safeIncludes(undefined, 'test')).toBe(false);
      expect(safeIncludes(null, 'test')).toBe(false);
    });
  });
});