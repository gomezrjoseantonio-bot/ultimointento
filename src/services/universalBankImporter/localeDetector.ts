/**
 * Locale Number Detection Service
 * Auto-detects decimal separator (comma/dot) and thousands separator for different locales
 */

export interface NumberLocale {
  decimalSep: ',' | '.';
  thousandSep: '.' | ',' | ' ' | '';
  confidence: number;
  samples: string[];
}

export interface ParsedAmount {
  value: number;
  confidence: number;
  originalText: string;
  locale: NumberLocale;
}

export class LocaleDetector {
  
  /**
   * Detect number locale from array of number strings
   */
  detectLocaleNumber(samples: string[]): NumberLocale {
    const cleanSamples = samples
      .filter(sample => this.isNumberLike(sample))
      .map(sample => sample.toString().trim())
      .filter(sample => sample.length > 0);

    if (cleanSamples.length === 0) {
      return this.getDefaultSpanishLocale();
    }

    // Analyze patterns in the samples
    const patterns = this.analyzeNumberPatterns(cleanSamples);
    
    // Determine locale based on patterns
    return this.determineLocale(patterns, cleanSamples);
  }

  /**
   * Parse amount using detected locale
   */
  parseImporte(amountStr: string, locale: NumberLocale): ParsedAmount {
    const cleaned = this.cleanNumberString(amountStr);
    
    try {
      const value = this.parseWithLocale(cleaned, locale);
      return {
        value,
        confidence: this.calculateParseConfidence(cleaned, locale),
        originalText: amountStr,
        locale
      };
    } catch (error) {
      return {
        value: 0,
        confidence: 0,
        originalText: amountStr,
        locale
      };
    }
  }

  /**
   * Check if string looks like a number
   */
  private isNumberLike(value: any): boolean {
    if (typeof value === 'number') return true;
    if (typeof value !== 'string') return false;
    
    const str = value.trim();
    // Match: optional minus, digits, optional separators, optional decimals
    return /^-?[\d.,\s]+$/.test(str) && str.length > 0;
  }

  /**
   * Analyze number patterns in samples
   */
  private analyzeNumberPatterns(samples: string[]): {
    commaAsDecimal: number;
    dotAsDecimal: number;
    commaAsThousands: number;
    dotAsThousands: number;
    spacesAsThousands: number;
    totalSamples: number;
  } {
    const patterns = {
      commaAsDecimal: 0,
      dotAsDecimal: 0,
      commaAsThousands: 0,
      dotAsThousands: 0,
      spacesAsThousands: 0,
      totalSamples: samples.length
    };

    for (const sample of samples) {
      const lastComma = sample.lastIndexOf(',');
      const lastDot = sample.lastIndexOf('.');
      
      // Pattern: X,XX at end (likely decimal comma)
      if (lastComma > -1 && lastComma === sample.lastIndexOf(',')) {
        const afterComma = sample.substring(lastComma + 1);
        if (/^\d{1,2}$/.test(afterComma)) {
          patterns.commaAsDecimal++;
        }
      }

      // Pattern: X.XX at end (could be decimal dot)
      if (lastDot > -1 && lastDot === sample.lastIndexOf('.')) {
        const afterDot = sample.substring(lastDot + 1);
        if (/^\d{1,2}$/.test(afterDot)) {
          patterns.dotAsDecimal++;
        }
      }

      // Pattern: X.XXX.XXX (thousands separators)
      const dotCount = (sample.match(/\./g) || []).length;
      if (dotCount > 1) {
        patterns.dotAsThousands++;
      }

      // Pattern: X,XXX,XXX (thousands separators)
      const commaCount = (sample.match(/,/g) || []).length;
      if (commaCount > 1) {
        patterns.commaAsThousands++;
      }
      
      // Pattern: X.XXX with comma decimal (e.g., "1.234,56")
      if (lastComma > -1 && lastDot > -1 && lastDot < lastComma) {
        patterns.dotAsThousands++;
      }

      // Pattern: X XXX XXX (space thousands separators)
      if (/\d\s+\d/.test(sample)) {
        patterns.spacesAsThousands++;
      }
    }

    return patterns;
  }

  /**
   * Determine locale based on patterns
   */
  private determineLocale(patterns: any, samples: string[]): NumberLocale {
    const { totalSamples } = patterns;
    
    // Spanish/European style: comma as decimal, dot/space as thousands
    const spanishScore = 
      (patterns.commaAsDecimal / totalSamples) * 0.5 +
      (patterns.dotAsThousands / totalSamples) * 0.3 +
      (patterns.spacesAsThousands / totalSamples) * 0.2;

    // Anglo style: dot as decimal, comma as thousands
    const angloScore = 
      (patterns.dotAsDecimal / totalSamples) * 0.5 +
      (patterns.commaAsThousands / totalSamples) * 0.3;

    // If we have clear evidence for Spanish format
    if (spanishScore > angloScore && spanishScore > 0.2) {
      const thousandSep = patterns.dotAsThousands > patterns.spacesAsThousands ? '.' : ' ';
      return {
        decimalSep: ',',
        thousandSep,
        confidence: Math.min(spanishScore + 0.4, 0.95), // Boost confidence
        samples: samples.slice(0, 5)
      };
    }

    // If we have clear evidence for Anglo format
    if (angloScore > spanishScore && angloScore > 0.2) {
      return {
        decimalSep: '.',
        thousandSep: ',',
        confidence: Math.min(angloScore + 0.4, 0.95), // Boost confidence
        samples: samples.slice(0, 5)
      };
    }

    // Default to Spanish locale for Spanish banking context
    return this.getDefaultSpanishLocale();
  }

  /**
   * Get default Spanish locale
   */
  getDefaultSpanishLocale(): NumberLocale {
    return {
      decimalSep: ',',
      thousandSep: '.',
      confidence: 0.6, // Default confidence
      samples: []
    };
  }

  /**
   * Clean number string for parsing
   */
  private cleanNumberString(str: string): string {
    return str
      .toString()
      .trim()
      .replace(/^\+/, '') // Remove leading +
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Parse number with specific locale - Enhanced for Treasury v1.2
   * Supports all Spanish bank formats: -38,69, 38,69-, (38,69), "Cargo/Abono", "Debe/Haber"
   */
  private parseWithLocale(cleanStr: string, locale: NumberLocale): number {
    let normalized = cleanStr.trim();

    // Detect all negative patterns from problem statement
    let isNegative = false;
    
    // Pattern 1: Standard minus sign (-38,69)
    if (normalized.startsWith('-')) {
      isNegative = true;
      normalized = normalized.substring(1);
    }
    
    // Pattern 2: Trailing minus (38,69-)
    if (normalized.endsWith('-')) {
      isNegative = true;
      normalized = normalized.substring(0, normalized.length - 1);
    }
    
    // Pattern 3: Parentheses for negative ((38,69))
    if (normalized.startsWith('(') && normalized.endsWith(')')) {
      isNegative = true;
      normalized = normalized.substring(1, normalized.length - 1);
    }

    // Pattern 4: "Cargo/Abono" and "Debe/Haber" handling  
    // This should be handled at column level, but detect text indicators
    const lowerNormalized = normalized.toLowerCase();
    if (lowerNormalized.includes('cargo') || lowerNormalized.includes('debe') || lowerNormalized.includes('debit')) {
      isNegative = true;
      // Remove the text part, keep only numbers
      normalized = normalized.replace(/[a-zA-ZÀ-ÿ\s]/g, '');
    } else if (lowerNormalized.includes('abono') || lowerNormalized.includes('haber') || lowerNormalized.includes('credit')) {
      isNegative = false;
      // Remove the text part, keep only numbers
      normalized = normalized.replace(/[a-zA-ZÀ-ÿ\s]/g, '');
    }

    // Clean remaining separators and whitespace
    normalized = normalized.trim();

    if (locale.decimalSep === ',') {
      // Spanish format: 1.234,56 or 1 234,56
      const lastComma = normalized.lastIndexOf(',');
      if (lastComma > -1) {
        const beforeComma = normalized.substring(0, lastComma);
        const afterComma = normalized.substring(lastComma + 1);
        
        // Validate decimal part (should be 1-2 digits)
        if (!/^\d{1,2}$/.test(afterComma)) {
          throw new Error(`Invalid decimal part: ${afterComma}`);
        }
        
        // Remove thousands separators from integer part (dots and spaces)
        const cleanInteger = beforeComma.replace(/[.\s]/g, '');
        if (!/^\d+$/.test(cleanInteger)) {
          throw new Error(`Invalid integer part: ${cleanInteger}`);
        }
        
        normalized = `${cleanInteger}.${afterComma}`;
      } else {
        // No decimal part, just remove thousands separators
        normalized = normalized.replace(/[.\s]/g, '');
        if (!/^\d+$/.test(normalized)) {
          throw new Error(`Invalid number format: ${normalized}`);
        }
      }
    } else {
      // Anglo format: 1,234.56
      const lastDot = normalized.lastIndexOf('.');
      if (lastDot > -1) {
        const beforeDot = normalized.substring(0, lastDot);
        const afterDot = normalized.substring(lastDot + 1);
        
        // Validate decimal part
        if (!/^\d{1,2}$/.test(afterDot)) {
          throw new Error(`Invalid decimal part: ${afterDot}`);
        }
        
        // Remove thousands separators from integer part
        const cleanInteger = beforeDot.replace(/[,\s]/g, '');
        if (!/^\d+$/.test(cleanInteger)) {
          throw new Error(`Invalid integer part: ${cleanInteger}`);
        }
        
        normalized = `${cleanInteger}.${afterDot}`;
      } else {
        // No decimal part, just remove thousands separators
        normalized = normalized.replace(/[,\s]/g, '');
        if (!/^\d+$/.test(normalized)) {
          throw new Error(`Invalid number format: ${normalized}`);
        }
      }
    }

    const result = parseFloat(normalized);
    if (isNaN(result)) {
      throw new Error(`Unable to parse number: ${cleanStr}`);
    }

    return isNegative ? -result : result;
  }

  /**
   * Calculate confidence for parsed result
   */
  private calculateParseConfidence(cleanStr: string, locale: NumberLocale): number {
    // Higher confidence for numbers that match expected patterns
    let confidence = 0.5;

    if (locale.decimalSep === ',') {
      // Spanish patterns
      if (/\d+,\d{2}$/.test(cleanStr)) confidence += 0.3; // Ends with ,XX
      if (/\d{1,3}(\.\d{3})*,\d{2}$/.test(cleanStr)) confidence += 0.2; // Full Spanish format
    } else {
      // Anglo patterns  
      if (/\d+\.\d{2}$/.test(cleanStr)) confidence += 0.3; // Ends with .XX
      if (/\d{1,3}(,\d{3})*\.\d{2}$/.test(cleanStr)) confidence += 0.2; // Full Anglo format
    }

    return Math.min(confidence, 0.95);
  }
}

export const localeDetector = new LocaleDetector();