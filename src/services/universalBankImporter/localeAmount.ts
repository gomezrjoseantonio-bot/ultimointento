/**
 * Locale-safe amount parser for Treasury
 * Converts locale-formatted amounts to cents (integer)
 * 
 * Handles all Spanish and international bank formats:
 * - 1.234,56 (Spanish/EU)
 * - 1,234.56 (English/US)
 * - 1234,56 | 1234.56
 * - 1 234,56 (space as thousands separator)
 * - (1.234,56) (parentheses for negative)
 * - -1.234,00 | 1.234,00- (prefix/suffix minus)
 * - CR/DR (credit/debit indicators)
 */

export interface ParseAmountResult {
  cents: number;
  ok: boolean;
}

/**
 * Parse locale-formatted amount string to cents (integer)
 * 
 * Rules:
 * - Remove spaces, symbols (€, EUR), NBSP, and letters
 * - Detect sign: prefix '-' or suffix '-', or parentheses () => negative
 * - Accept: 1.234,56 | 1,234.56 | 1234,56 | 1 234,56 | 1234.56 | (1.234,56) | 1.234 | 1,234 | -1.234,00 | 1.234,00- | CR/DR
 * - If HAS both separators (',' and '.'): the *rightmost separator* is the decimal; the other is thousands
 * - If ONLY has ',': treat as *decimal* if 1-2 digits to the right; if >2, it's thousands (decimal implicit 00)
 * - If ONLY has '.': treat as *decimal* if 1-2 digits to the right; if >2, it's thousands
 * - If NO separators: integer euros → *100
 * - Round to nearest cent and return integer
 */
export function parseAmountToCents(raw: string): ParseAmountResult {
  try {
    // Step 1: Detect sign early (before removing spaces)
    // Check for DR (debit = negative) / CR (credit = positive)
    let neg = false;
    let rawCopy = raw;
    
    if (/\bDR\b/i.test(rawCopy)) {
      neg = true;
      rawCopy = rawCopy.replace(/\bDR\b/gi, '');
    } else if (/\bCR\b/i.test(rawCopy)) {
      neg = false;
      rawCopy = rawCopy.replace(/\bCR\b/gi, '');
    }

    // Step 2: Clean the string - remove spaces, NBSP, currency symbols, EUR text
    // \u00A0 is non-breaking space (NBSP)
    let s0 = rawCopy
      .replace(/\s|\u00A0/g, '') // Remove all spaces including NBSP
      .replace(/€|EUR/gi, '')     // Remove currency symbols and text
      .trim();

    if (!s0 || s0.length === 0) {
      return { cents: 0, ok: false };
    }

    // Step 3: Detect additional sign patterns

    // Check for prefix plus (remove it, keep positive)
    if (/^\+/.test(s0)) {
      s0 = s0.substring(1);
    }

    // Check for parentheses (negative)
    if (/^\(/.test(s0) && /\)$/.test(s0)) {
      neg = true;
    }

    // Check for prefix minus
    if (/^-/.test(s0)) {
      neg = true;
    }

    // Check for suffix minus
    if (/-\s*$/.test(s0)) {
      neg = true;
    }

    // Step 4: Remove sign characters and parentheses for parsing
    let s = s0
      .replace(/[()]/g, '')           // Remove parentheses
      .replace(/^-|-\s*$/g, '')       // Remove prefix/suffix minus
      .replace(/[a-zA-Z]/g, '')       // Remove any remaining letters
      .trim();

    if (!s || s.length === 0) {
      return { cents: 0, ok: false };
    }

    // Step 5: Locate separators
    const lastDotIdx = s.lastIndexOf('.');
    const lastCommaIdx = s.lastIndexOf(',');

    let value: number;

    // Case 1: Both separators present - rightmost is decimal
    if (lastDotIdx > -1 && lastCommaIdx > -1) {
      if (lastCommaIdx > lastDotIdx) {
        // Comma is decimal separator (e.g., 1.234,56 or 9.876,543)
        const decimalPart = s.substring(lastCommaIdx + 1);
        const integerPart = s.substring(0, lastCommaIdx).replace(/[.,]/g, ''); // Remove all separators
        
        if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(decimalPart)) {
          return { cents: 0, ok: false };
        }
        
        // Keep original precision for the float value (don't round yet)
        value = parseFloat(`${integerPart}.${decimalPart}`);
      } else {
        // Dot is decimal separator (e.g., 1,234.56)
        const decimalPart = s.substring(lastDotIdx + 1);
        const integerPart = s.substring(0, lastDotIdx).replace(/[.,]/g, ''); // Remove all separators
        
        if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(decimalPart)) {
          return { cents: 0, ok: false };
        }
        
        // Keep original precision for the float value
        value = parseFloat(`${integerPart}.${decimalPart}`);
      }
    }
    // Case 2: Only comma present
    else if (lastCommaIdx > -1 && lastDotIdx === -1) {
      const afterComma = s.substring(lastCommaIdx + 1);
      const k = afterComma.length;
      
      if (k >= 1 && k <= 2) {
        // Comma is decimal separator (e.g., 32,18 or 1.234,56)
        const integerPart = s.substring(0, lastCommaIdx).replace(/[.,\s]/g, ''); // Remove thousands separators
        
        if (!/^\d+$/.test(integerPart) || !/^\d{1,2}$/.test(afterComma)) {
          return { cents: 0, ok: false };
        }
        
        value = parseFloat(`${integerPart}.${afterComma}`);
      } else {
        // Comma is thousands separator (e.g., 2,000 means 2000)
        const cleanNumber = s.replace(/,/g, '');
        
        if (!/^\d+$/.test(cleanNumber)) {
          return { cents: 0, ok: false };
        }
        
        value = parseFloat(cleanNumber);
      }
    }
    // Case 3: Only dot present
    else if (lastDotIdx > -1 && lastCommaIdx === -1) {
      const afterDot = s.substring(lastDotIdx + 1);
      const k = afterDot.length;
      
      if (k >= 1 && k <= 2) {
        // Dot is decimal separator (e.g., 32.18 or 1,234.56)
        const integerPart = s.substring(0, lastDotIdx).replace(/[.,\s]/g, ''); // Remove thousands separators
        
        if (!/^\d+$/.test(integerPart) || !/^\d{1,2}$/.test(afterDot)) {
          return { cents: 0, ok: false };
        }
        
        value = parseFloat(`${integerPart}.${afterDot}`);
      } else {
        // Dot is thousands separator (e.g., 2.000 means 2000)
        const cleanNumber = s.replace(/\./g, '');
        
        if (!/^\d+$/.test(cleanNumber)) {
          return { cents: 0, ok: false };
        }
        
        value = parseFloat(cleanNumber);
      }
    }
    // Case 4: No separators - integer euros
    else {
      const cleanNumber = s.replace(/[.,\s]/g, '');
      
      if (!/^\d+$/.test(cleanNumber)) {
        return { cents: 0, ok: false };
      }
      
      value = parseFloat(cleanNumber);
    }

    // Step 5: Convert to cents and round
    if (isNaN(value)) {
      return { cents: 0, ok: false };
    }

    let cents = Math.round(value * 100);

    // Step 6: Apply sign
    if (neg) {
      cents = -cents;
    }

    return { cents, ok: true };

  } catch (error) {
    return { cents: 0, ok: false };
  }
}
