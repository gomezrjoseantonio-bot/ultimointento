/**
 * Date Format Detection Service
 * Auto-detects and parses dates in common Spanish and international formats
 */

export interface DateFormat {
  pattern: string;
  regex: RegExp;
  parseFunc: (match: RegExpMatchArray) => Date;
  confidence: number;
}

export interface DateParseResult {
  date: Date;
  format: string;
  confidence: number;
  originalText: string;
}

export class DateFormatDetector {
  
  private static readonly DATE_FORMATS: DateFormat[] = [
    // Spanish DD/MM/YYYY variants (most common in Spanish banks)
    {
      pattern: 'DD/MM/YYYY',
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parseFunc: (match) => new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])),
      confidence: 0.9
    },
    {
      pattern: 'DD-MM-YYYY',
      regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      parseFunc: (match) => new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])),
      confidence: 0.9
    },
    {
      pattern: 'DD/MM/YY',
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      parseFunc: (match) => {
        const year = parseInt(match[3]);
        const fullYear = year > 50 ? 1900 + year : 2000 + year; // 50+ = 19xx, else 20xx
        return new Date(fullYear, parseInt(match[2]) - 1, parseInt(match[1]));
      },
      confidence: 0.8
    },
    {
      pattern: 'DD-MM-YY',
      regex: /^(\d{1,2})-(\d{1,2})-(\d{2})$/,
      parseFunc: (match) => {
        const year = parseInt(match[3]);
        const fullYear = year > 50 ? 1900 + year : 2000 + year;
        return new Date(fullYear, parseInt(match[2]) - 1, parseInt(match[1]));
      },
      confidence: 0.8
    },
    
    // ISO and international formats
    {
      pattern: 'YYYY-MM-DD',
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      parseFunc: (match) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])),
      confidence: 0.95
    },
    {
      pattern: 'YYYY/MM/DD',
      regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
      parseFunc: (match) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])),
      confidence: 0.85
    },
    
    // US format MM/DD/YYYY (lower confidence in Spanish context)
    {
      pattern: 'MM/DD/YYYY',
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parseFunc: (match) => new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2])),
      confidence: 0.6
    },
    
    // Compact formats without separators
    {
      pattern: 'DDMMYYYY',
      regex: /^(\d{2})(\d{2})(\d{4})$/,
      parseFunc: (match) => new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])),
      confidence: 0.7
    },
    {
      pattern: 'YYYYMMDD',
      regex: /^(\d{4})(\d{2})(\d{2})$/,
      parseFunc: (match) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])),
      confidence: 0.85
    }
  ];

  /**
   * Detect date format from array of date samples
   */
  detectDateFormat(samples: string[]): { format: string; confidence: number } {
    const cleanSamples = samples
      .filter(sample => this.isDateLike(sample))
      .map(sample => sample.toString().trim())
      .filter(sample => sample.length > 0);

    if (cleanSamples.length === 0) {
      return { format: 'DD/MM/YYYY', confidence: 0.5 }; // Default Spanish format
    }

    // Try each format and count successful parses
    const formatScores: { [format: string]: { score: number; confidence: number } } = {};

    for (const format of DateFormatDetector.DATE_FORMATS) {
      let successfulParses = 0;
      let totalConfidence = 0;

      for (const sample of cleanSamples) {
        const result = this.tryParseWithFormat(sample, format);
        if (result && this.isValidDate(result.date)) {
          successfulParses++;
          totalConfidence += result.confidence;
        }
      }

      if (successfulParses > 0) {
        const successRate = successfulParses / cleanSamples.length;
        const avgConfidence = totalConfidence / successfulParses;
        formatScores[format.pattern] = {
          score: successRate * avgConfidence,
          confidence: avgConfidence
        };
      }
    }

    // Find best format
    let bestFormat = 'DD/MM/YYYY';
    let bestScore = 0;
    let bestConfidence = 0.5;

    for (const [pattern, scoreData] of Object.entries(formatScores)) {
      if (scoreData.score > bestScore) {
        bestScore = scoreData.score;
        bestFormat = pattern;
        bestConfidence = scoreData.confidence;
      }
    }

    return { format: bestFormat, confidence: bestConfidence };
  }

  /**
   * Parse single date with auto-detection
   */
  parseDate(dateStr: string): DateParseResult | null {
    const cleaned = this.cleanDateString(dateStr);
    
    if (!this.isDateLike(cleaned)) {
      return null;
    }

    // Try formats in order of confidence
    const sortedFormats = [...DateFormatDetector.DATE_FORMATS]
      .sort((a, b) => b.confidence - a.confidence);

    for (const format of sortedFormats) {
      const result = this.tryParseWithFormat(cleaned, format);
      if (result && this.isValidDate(result.date)) {
        return result;
      }
    }

    return null;
  }

  /**
   * Parse date with specific format
   */
  parseDateWithFormat(dateStr: string, formatPattern: string): DateParseResult | null {
    const format = DateFormatDetector.DATE_FORMATS.find(f => f.pattern === formatPattern);
    if (!format) {
      return null;
    }

    const cleaned = this.cleanDateString(dateStr);
    return this.tryParseWithFormat(cleaned, format);
  }

  /**
   * Check if string looks like a date
   */
  private isDateLike(value: any): boolean {
    if (typeof value !== 'string') return false;
    
    const str = value.trim();
    // Match common date patterns: digits and separators
    return /^[\d\/\-\s.]+$/.test(str) && 
           str.length >= 6 && 
           str.length <= 10 &&
           /\d/.test(str);
  }

  /**
   * Try to parse date with specific format
   */
  private tryParseWithFormat(dateStr: string, format: DateFormat): DateParseResult | null {
    const match = dateStr.match(format.regex);
    if (!match) {
      return null;
    }

    try {
      const date = format.parseFunc(match);
      return {
        date,
        format: format.pattern,
        confidence: format.confidence,
        originalText: dateStr
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate that date is reasonable for banking context
   */
  private isValidDate(date: Date): boolean {
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    return date instanceof Date && 
           !isNaN(date.getTime()) &&
           date >= tenYearsAgo && 
           date <= oneYearFromNow;
  }

  /**
   * Clean date string for parsing
   */
  private cleanDateString(str: string): string {
    return str
      .toString()
      .trim()
      .replace(/\s+/g, '') // Remove spaces
      .replace(/\./g, '/'); // Normalize dots to slashes
  }

  /**
   * Get supported date format patterns
   */
  getSupportedFormats(): string[] {
    return DateFormatDetector.DATE_FORMATS.map(f => f.pattern);
  }
}

export const dateFormatDetector = new DateFormatDetector();