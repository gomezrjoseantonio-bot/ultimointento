/**
 * Universal File Format Detector
 * Supports CSV, XLS, XLSX, OFX, QIF with MIME type and header-based detection
 */

export type SupportedFormat = 'CSV' | 'XLS' | 'XLSX' | 'OFX' | 'QIF';

export interface FileFormatResult {
  format: SupportedFormat;
  confidence: number;
  encoding?: string;
  csvDelimiter?: string;
  reason: string;
}

export class FileFormatDetector {
  private static readonly OFX_SIGNATURES = [
    'OFXHEADER:',
    '<OFX>',
    'OFXHEADER',
    'DATA:OFXSGML'
  ];

  private static readonly QIF_SIGNATURES = [
    '!Type:',
    '!Account',
    '!Option:',
    '^',
    'D' // Date field in QIF
  ];

  /**
   * Detect file format from File object
   */
  async detectFormat(file: File): Promise<FileFormatResult> {
    const mimeType = file.type;
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split('.').pop() || '';

    // 1. Try MIME type detection first
    const mimeResult = this.detectByMimeType(mimeType, fileExt);
    if (mimeResult.confidence >= 0.9) {
      return mimeResult;
    }

    // 2. Read file header for content-based detection
    const headerBuffer = await this.readFileHeader(file, 2048);
    const headerText = this.tryDecodeHeader(headerBuffer);

    // 3. Content-based detection
    const contentResult = this.detectByContent(headerText, fileExt);
    
    // 4. Return best result
    return contentResult.confidence > mimeResult.confidence ? contentResult : mimeResult;
  }

  /**
   * Detect format by MIME type and extension
   */
  private detectByMimeType(mimeType: string, fileExt: string): FileFormatResult {
    // Excel formats
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExt === 'xlsx') {
      return {
        format: 'XLSX',
        confidence: 0.95,
        reason: 'MIME type or extension indicates XLSX'
      };
    }

    if (mimeType === 'application/vnd.ms-excel' || fileExt === 'xls') {
      return {
        format: 'XLS',
        confidence: 0.95,
        reason: 'MIME type or extension indicates XLS'
      };
    }

    // CSV formats
    if (mimeType === 'text/csv' || fileExt === 'csv') {
      return {
        format: 'CSV',
        confidence: 0.90,
        reason: 'MIME type or extension indicates CSV'
      };
    }

    // OFX/QIF extensions
    if (fileExt === 'ofx') {
      return {
        format: 'OFX',
        confidence: 0.90,
        reason: 'Extension indicates OFX'
      };
    }

    if (fileExt === 'qif') {
      return {
        format: 'QIF',
        confidence: 0.90,
        reason: 'Extension indicates QIF'
      };
    }

    // Fallback to CSV for text types
    if (mimeType.startsWith('text/')) {
      return {
        format: 'CSV',
        confidence: 0.60,
        reason: 'Text MIME type, assuming CSV'
      };
    }

    return {
      format: 'CSV',
      confidence: 0.30,
      reason: 'Unknown format, defaulting to CSV'
    };
  }

  /**
   * Detect format by file content
   */
  private detectByContent(headerText: string, fileExt: string): FileFormatResult {
    const upperHeader = headerText.toUpperCase();
    
    // Check for OFX signatures
    for (const signature of FileFormatDetector.OFX_SIGNATURES) {
      if (upperHeader.includes(signature.toUpperCase())) {
        return {
          format: 'OFX',
          confidence: 0.95,
          reason: `OFX signature found: ${signature}`
        };
      }
    }

    // Check for QIF signatures
    for (const signature of FileFormatDetector.QIF_SIGNATURES) {
      if (headerText.includes(signature)) {
        return {
          format: 'QIF',
          confidence: 0.95,
          reason: `QIF signature found: ${signature}`
        };
      }
    }

    // Check for binary Excel headers
    if (this.isBinaryExcel(headerText)) {
      return {
        format: fileExt === 'xlsx' ? 'XLSX' : 'XLS',
        confidence: 0.85,
        reason: 'Binary Excel format detected'
      };
    }

    // CSV detection by delimiter patterns
    const csvResult = this.detectCSVFormat(headerText);
    if (csvResult) {
      return {
        format: 'CSV',
        confidence: 0.80,
        csvDelimiter: csvResult.delimiter,
        reason: `CSV format detected with delimiter: ${csvResult.delimiter}`
      };
    }

    return {
      format: 'CSV',
      confidence: 0.40,
      reason: 'Content analysis inconclusive, defaulting to CSV'
    };
  }

  /**
   * Check if content is binary Excel
   */
  private isBinaryExcel(text: string): boolean {
    // Look for binary patterns that suggest Excel
    return text.includes('PK') || // ZIP-based XLSX
           text.includes('\x09\x08') || // XLS signature
           text.includes('Microsoft') ||
           text.includes('Excel');
  }

  /**
   * Detect CSV delimiter from content
   */
  private detectCSVFormat(text: string): { delimiter: string } | null {
    const delimiters = [';', ',', '\t', '|'];
    const lines = text.split('\n').slice(0, 5); // Check first 5 lines
    
    let bestDelimiter = ';'; // Default for Spanish banks
    let maxColumns = 0;

    for (const delimiter of delimiters) {
      let totalColumns = 0;
      let consistentLines = 0;
      let firstLineColumns = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split(delimiter).length;
        if (i === 0) {
          firstLineColumns = columns;
        }

        totalColumns += columns;
        if (Math.abs(columns - firstLineColumns) <= 1) {
          consistentLines++;
        }
      }

      // Prefer delimiter with more columns and consistency
      const avgColumns = totalColumns / lines.length;
      const consistency = consistentLines / lines.length;
      
      if (avgColumns >= 3 && consistency >= 0.8 && avgColumns > maxColumns) {
        maxColumns = avgColumns;
        bestDelimiter = delimiter;
      }
    }

    return maxColumns >= 3 ? { delimiter: bestDelimiter } : null;
  }

  /**
   * Read file header as buffer
   */
  private async readFileHeader(file: File, bytes: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file.slice(0, bytes));
    });
  }

  /**
   * Try to decode header with multiple encodings
   */
  private tryDecodeHeader(buffer: ArrayBuffer): string {
    const encodings = ['utf-8', 'iso-8859-1', 'windows-1252'];
    
    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding, { fatal: true });
        return decoder.decode(buffer);
      } catch {
        // Try next encoding
      }
    }

    // Fallback to non-fatal UTF-8
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }
}

export const fileFormatDetector = new FileFormatDetector();