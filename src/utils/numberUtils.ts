/**
 * Spanish Number Parsing Utilities (es-ES)
 * 
 * Implements deterministic parsing rules for Spanish numeric format:
 * - Comma as decimal separator, dot/space as thousands separator
 * - Anti-join protection to prevent decimal loss (34,56 → 3455)
 * - Heuristic handling for dot-only numbers (34.56 vs 3.455)
 * - Error codes for invalid/ambiguous cases
 */

export interface ParseResult {
  value: number | null;
  code?: 'DECIMAL_LOSS' | 'INVALID_NUMBER_ES' | 'VALUE_DRIFT';
  message?: string;
}

export interface ParseOptions {
  allowPercent?: boolean;
  maxDecimals?: number;
  googleNormalizedValue?: number; // For drift detection
  mentionText?: string; // Original OCR text for validation
}

/**
 * Central Spanish number parser implementing all requirements
 */
export function parseEsNumber(input: string, opts: ParseOptions = {}): ParseResult {
  if (!input || input.trim() === '') {
    return { value: null };
  }

  const { allowPercent = false, maxDecimals = 2, googleNormalizedValue, mentionText } = opts;
  
  // Step 1: Clean input - remove currency symbols, %, spaces, but preserve structure
  let cleaned = input.trim()
    .replace(/[€$£¥]/g, '') // Remove currency symbols
    .replace(/%/g, allowPercent ? '' : '') // Remove % if allowed
    .replace(/[\u00A0\u2009\u202F]/g, '') // Remove non-breaking spaces, thin spaces
    .trim();

  // Handle negative signs
  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/^-/, '');

  // Step 2: Validate against mention text for anti-join protection
  if (mentionText) {
    const originalDecimalMatch = mentionText.match(/,(\d{1,2})(?!\d)/);
    if (originalDecimalMatch) {
      const expectedDecimal = originalDecimalMatch[1];
      // If the cleaned version loses the decimal part, it's a join
      if (!cleaned.includes(`,${expectedDecimal}`)) {
        return { 
          value: null, 
          code: 'DECIMAL_LOSS',
          message: `Decimal part ,${expectedDecimal} lost during parsing` 
        };
      }
    }
  }

  // Step 3: Check for multiple commas (invalid)
  const commaCount = (cleaned.match(/,/g) || []).length;
  if (commaCount > 1) {
    return { 
      value: null, 
      code: 'INVALID_NUMBER_ES',
      message: 'Multiple commas not allowed' 
    };
  }

  // Step 4: Apply parsing rules
  let result: number;

  if (cleaned.includes(',')) {
    // Rule: Has comma - comma is decimal separator
    const parts = cleaned.split(',');
    const [integerPart, decimalPart] = parts;
    
    // Validate decimal part length
    if (decimalPart.length > maxDecimals) {
      return { 
        value: null, 
        code: 'INVALID_NUMBER_ES',
        message: `Decimal part too long: ${decimalPart.length} digits (max ${maxDecimals})` 
      };
    }

    // Remove dots from integer part (thousands separators) and validate
    const cleanInteger = integerPart.replace(/[.\s]/g, '');
    
    if (!/^\d+$/.test(cleanInteger) || !/^\d{1,}$/.test(decimalPart)) {
      return { 
        value: null, 
        code: 'INVALID_NUMBER_ES',
        message: 'Invalid digits in integer or decimal part' 
      };
    }

    result = parseFloat(`${cleanInteger}.${decimalPart}`);
  } else if (cleaned.includes('.')) {
    // Rule: Only dots - apply heuristic
    const dotIndex = cleaned.lastIndexOf('.');
    const afterDot = cleaned.substring(dotIndex + 1);
    
    if (afterDot.length === 2) {
      // Exactly 2 digits after dot → treat as decimal (bank export style)
      const beforeDot = cleaned.substring(0, dotIndex).replace(/[.\s]/g, '');
      if (!/^\d+$/.test(beforeDot) || !/^\d{2}$/.test(afterDot)) {
        return { 
          value: null, 
          code: 'INVALID_NUMBER_ES',
          message: 'Invalid format for dot-decimal interpretation' 
        };
      }
      result = parseFloat(`${beforeDot}.${afterDot}`);
    } else {
      // Otherwise → dots are thousands separators
      const cleanInteger = cleaned.replace(/[.\s]/g, '');
      if (!/^\d+$/.test(cleanInteger)) {
        return { 
          value: null, 
          code: 'INVALID_NUMBER_ES',
          message: 'Invalid digits in thousands-separated number' 
        };
      }
      result = parseFloat(cleanInteger);
    }
  } else {
    // No separators - just digits
    const cleanInteger = cleaned.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanInteger)) {
      return { 
        value: null, 
        code: 'INVALID_NUMBER_ES',
        message: 'Invalid digits in plain number' 
      };
    }
    result = parseFloat(cleanInteger);
  }

  // Apply negative sign
  if (isNegative) {
    result = -result;
  }

  // Step 5: Check for value drift vs Google's normalized value
  if (googleNormalizedValue !== undefined) {
    const drift = Math.abs(result - googleNormalizedValue) / Math.max(Math.abs(googleNormalizedValue), 1);
    if (drift > 0.05) { // >5% drift
      return {
        value: result,
        code: 'VALUE_DRIFT',
        message: `Value drift ${(drift * 100).toFixed(1)}% from Google's normalized value`
      };
    }
  }

  // Step 6: Round to appropriate decimal places
  const rounded = Math.round(result * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals);
  
  return { value: rounded };
}

/**
 * Format number to Spanish locale (for display)
 */
export function formatEsCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true, // Enable thousands separators
  }).format(amount);
}

/**
 * Format percentage to Spanish locale (for display)
 */
export function formatEsPercentage(rate: number): string {
  // rate is already normalized (0.0852 for 8.52%)
  const percentage = rate * 100;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(percentage) + ' %';
}

/**
 * Validate invoice amount harmony: Base + IVA ≈ Total ± 0.01€
 */
export function validateInvoiceHarmony(base: number, iva: number, total: number, discounts: number = 0): {
  isValid: boolean;
  expectedTotal: number;
  difference: number;
} {
  // Use precise decimal arithmetic to avoid floating point issues
  const expectedTotalCents = Math.round(base * 100) + Math.round(iva * 100) - Math.round(discounts * 100);
  const expectedTotal = expectedTotalCents / 100;
  
  const difference = Math.abs(total - expectedTotal);
  const tolerance = 0.01; // ±0.01 tolerance as specified
  
  // Round difference to avoid floating point precision issues
  const roundedDifference = Math.round(difference * 100) / 100;
  
  return {
    isValid: roundedDifference <= tolerance,
    expectedTotal,
    difference: roundedDifference
  };
}