// H8 REFACTOR: Enhanced CSV/Excel Parser Service with Bank Profile Detection
import * as XLSX from 'xlsx';
import { bankProfilesService } from './bankProfilesService';
import { BankProfile, ParsedMovement, ParseResult } from '../types/bankProfiles';

export interface CSVRow {
  [key: string]: string;
}

// File size and row limits for safety
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_ROWS = 50000;
const HEADER_SEARCH_ROWS = 40;

class EnhancedCSVParser {
  
  /**
   * Main entry point for parsing CSV/Excel files
   */
  async parseFile(file: File): Promise<ParseResult> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Archivo demasiado grande. Máximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const fileName = file.name;
    const mime = file.type;
    const size = file.size;

    try {
      let data: any[][];
      let sheetName: string | undefined;

      if (this.isExcelFile(file)) {
        const result = await this.parseExcel(file);
        data = result.data;
        sheetName = result.sheetName;
      } else {
        data = await this.parseCSV(file);
      }

      return this.processData(data, {
        fileName,
        mime,
        size,
        sheetName
      });

    } catch (error) {
      throw new Error(`Error procesando archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Process the raw data array and detect headers, clean data, and parse movements
   */
  private async processData(data: any[][], fileInfo: {
    fileName: string;
    mime: string;
    size: number;
    sheetName?: string;
  }): Promise<ParseResult> {
    
    if (data.length === 0) {
      throw new Error('El archivo está vacío');
    }

    // Validate row count
    if (data.length > MAX_ROWS) {
      console.warn(`Archivo con ${data.length} filas, procesando en chunks...`);
      data = data.slice(0, MAX_ROWS);
    }

    // Step 1: Find real headers (anti-logo/header detection)
    const headerResult = this.findRealHeaders(data);
    if (!headerResult) {
      throw new Error('No se pudieron detectar cabeceras válidas en el archivo');
    }

    const { headerRow, headers } = headerResult;
    
    // Step 2: Detect bank using global profiles
    const detectedBank = await bankProfilesService.detectBank(headers);
    
    if (!detectedBank && !(import.meta as any).env?.DEV) {
      throw new Error('Banco no soportado aún. Añade perfil al registro global.');
    }

    // Step 3: Use detected profile or fallback to generic
    const profile = detectedBank?.profile || await bankProfilesService.getGenericProfile();
    const headerMapping = bankProfilesService.mapHeaders(headers, profile);

    // Validate required fields
    if (!headerMapping.date || !headerMapping.amount) {
      throw new Error('No se encontraron las columnas requeridas (fecha y importe)');
    }

    // Step 4: Clean and parse data rows
    const dataRows = data.slice(headerRow + 1);
    const cleanedRows = this.cleanDataRows(dataRows, profile);
    
    // Step 5: Parse movements
    const movements: ParsedMovement[] = [];
    const errors: string[] = [];
    let validRowCount = 0;
    let invalidRowCount = 0;

    for (let i = 0; i < cleanedRows.length; i++) {
      const row = cleanedRows[i];
      const originalRowIndex = headerRow + 1 + i;

      try {
        const movement = this.parseMovement(row, headerMapping, profile, originalRowIndex);
        if (movement) {
          movements.push(movement);
          validRowCount++;
        } else {
          invalidRowCount++;
        }
      } catch (error) {
        errors.push(`Fila ${originalRowIndex + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        invalidRowCount++;
      }
    }

    // Ensure at least one valid movement
    if (movements.length === 0) {
      throw new Error('No se encontraron movimientos válidos en el archivo');
    }

    return {
      success: true,
      movements,
      totalRows: data.length,
      errors,
      detectedBank: detectedBank || undefined,
      preview: movements.slice(0, 20),
      metadata: {
        bankKey: detectedBank?.bankKey,
        bankVersion: detectedBank?.bankVersion,
        sheetName: fileInfo.sheetName,
        headerRow,
        headersOriginal: headers,
        rowsImported: validRowCount,
        rowsOmitted: cleanedRows.length - movements.length,
        rowsInvalid: invalidRowCount,
        importedAt: new Date().toISOString(),
        fileName: fileInfo.fileName,
        mime: fileInfo.mime,
        size: fileInfo.size
      }
    };
  }

  /**
   * Find the real header row by looking for rows with >= 2 matches and one must be amount
   */
  private findRealHeaders(data: any[][]): { headerRow: number; headers: string[] } | null {
    const searchRows = Math.min(HEADER_SEARCH_ROWS, data.length);

    for (let i = 0; i < searchRows; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const headers = row.map(cell => String(cell || '').trim()).filter(h => h);
      if (headers.length < 2) continue;

      // Check if this looks like a header row by testing with bank profiles
      const normalizedHeaders = headers.map(h => this.normalizeText(h));
      
      // Quick check: does this row have potential field names?
      const hasDateLike = normalizedHeaders.some(h => 
        h.includes('fecha') || h.includes('date') || h.includes('data')
      );
      const hasAmountLike = normalizedHeaders.some(h => 
        h.includes('importe') || h.includes('amount') || h.includes('cantidad') || 
        h.includes('monto') || h.includes('euros') || h.includes('import')
      );

      if (hasDateLike && hasAmountLike) {
        return { headerRow: i, headers };
      }
    }

    return null;
  }

  /**
   * Clean data rows by removing junk patterns and invalid data
   */
  private cleanDataRows(rows: any[][], profile: BankProfile): any[][] {
    const cleanedRows: any[][] = [];
    let consecutiveInvalid = 0;
    let validCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (this.isJunkRow(row, profile)) {
        consecutiveInvalid++;
        // Stop if we have >= 5 valid rows and >= 3 consecutive invalid rows
        if (validCount >= 5 && consecutiveInvalid >= 3) {
          break;
        }
        continue;
      }

      cleanedRows.push(row);
      validCount++;
      consecutiveInvalid = 0;
    }

    return cleanedRows;
  }

  /**
   * Check if a row should be considered junk/noise
   */
  private isJunkRow(row: any[], profile: BankProfile): boolean {
    if (!row || row.length === 0) return true;

    const rowText = row.join(' ').toLowerCase();
    
    // Check noise patterns
    for (const pattern of profile.noisePatterns) {
      if (rowText.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check for separators or empty rows
    if (rowText.match(/^[\s\-*]+$/)) return true;

    // Check if all cells are empty
    if (row.every(cell => !cell || String(cell).trim() === '')) return true;

    return false;
  }

  /**
   * Parse a single movement from a data row
   */
  private parseMovement(
    row: any[], 
    mapping: Record<string, number>, 
    profile: BankProfile,
    originalRow: number
  ): ParsedMovement | null {
    
    // Extract values
    const dateValue = row[mapping.date];
    const valueDateValue = mapping.valueDate !== undefined ? row[mapping.valueDate] : undefined;
    const amountValue = row[mapping.amount];
    const descriptionValue = row[mapping.description] || '';
    const counterpartyValue = mapping.counterparty !== undefined ? row[mapping.counterparty] : undefined;

    // Validate required fields
    if (!dateValue || !amountValue) return null;

    try {
      // Parse date
      const date = this.parseDate(dateValue, profile);
      if (!date) throw new Error('Fecha inválida');

      // Parse amount
      const amount = this.parseAmount(amountValue, profile);
      if (isNaN(amount)) throw new Error('Importe inválido');

      // Parse value date if present
      let valueDate: Date | undefined;
      if (valueDateValue) {
        const parsed = this.parseDate(valueDateValue, profile);
        valueDate = parsed || undefined;
      }

      return {
        date,
        valueDate,
        amount,
        description: String(descriptionValue).trim(),
        counterparty: counterpartyValue ? String(counterpartyValue).trim() : undefined,
        originalRow,
        rawData: row.reduce((acc, cell, index) => {
          acc[`col_${index}`] = cell;
          return acc;
        }, {} as Record<string, any>)
      };

    } catch (error) {
      console.warn(`Error parsing row ${originalRow}:`, error);
      return null;
    }
  }

  /**
   * Parse date with multiple format support
   */
  private parseDate(value: any, profile: BankProfile): Date | null {
    if (!value) return null;

    // Handle Excel serial dates
    if (typeof value === 'number' && profile.dateHints?.includes('excel-serial')) {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return new Date(date.y, date.m - 1, date.d); // Note: month is 0-indexed in Date
      }
    }

    const dateStr = String(value).trim();
    if (!dateStr) return null;

    // Try different date formats
    const formats = profile.dateHints || ['dd/mm/yyyy', 'dd-mm-yyyy'];
    
    for (const format of formats) {
      try {
        const parsed = this.parseSpecificDateFormat(dateStr, format);
        if (parsed) return parsed;
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Parse date in specific format
   */
  private parseSpecificDateFormat(dateStr: string, format: string): Date | null {
    let day: number, month: number, year: number;

    if (format === 'dd/mm/yyyy' || format === 'dd-mm-yyyy') {
      const separator = format.includes('/') ? '/' : '-';
      const parts = dateStr.split(separator);
      if (parts.length !== 3) return null;

      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else if (format === 'yyyy-mm-dd') {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;

      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      return null;
    }

    // Validate date components
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null;

    // Return Date object (month is 0-indexed in Date constructor)
    return new Date(year, month - 1, day);
  }

  /**
   * Parse amount with Spanish formatting support
   */
  private parseAmount(value: any, profile: BankProfile): number {
    if (typeof value === 'number') return value;

    let amountStr = String(value || '').trim();
    if (!amountStr) return NaN;

    // Remove currency symbols and spaces
    amountStr = amountStr.replace(/[€$\s]/g, '');

    // Handle Spanish formatting (1.234,56)
    if (profile.numberFormat.decimal === ',' && profile.numberFormat.thousand === '.') {
      // Replace thousands separators first, then decimal separator
      amountStr = amountStr.replace(/\./g, '').replace(/,/g, '.');
    }

    const amount = parseFloat(amountStr);
    return isNaN(amount) ? NaN : amount;
  }

  /**
   * Check if file is Excel format
   */
  private isExcelFile(file: File): boolean {
    const extension = file.name.toLowerCase().split('.').pop();
    return ['xlsx', 'xls'].includes(extension || '');
  }

  /**
   * Parse Excel file
   */
  private async parseExcel(file: File): Promise<{ data: any[][]; sheetName: string }> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Use first sheet or hint from profile
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('No se encontraron hojas válidas en el archivo Excel');
    }

    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      dateNF: 'yyyy-mm-dd' 
    }) as any[][];

    return { data, sheetName };
  }

  /**
   * Parse CSV file
   */
  private async parseCSV(file: File): Promise<any[][]> {
    const text = await file.text();
    const separator = this.detectSeparator(text);
    
    const lines = text.split('\n');
    const data: any[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = this.parseCSVLine(line, separator);
      data.push(row);
    }

    return data;
  }

  /**
   * Parse a single CSV line respecting quotes
   */
  private parseCSVLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Detect CSV separator
   */
  private detectSeparator(csvText: string): ',' | ';' {
    const firstLine = csvText.split('\n')[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const enhancedCSVParser = new EnhancedCSVParser();

// Legacy exports for compatibility
export type { ParsedMovement, ParseResult } from '../types/bankProfiles';

// Legacy compatibility function
export async function parseCSV(csvText: string): Promise<ParseResult> {
  // Create a File-like object from the CSV text
  const file = new File([csvText], 'import.csv', { type: 'text/csv' });
  return enhancedCSVParser.parseFile(file);
}

// Legacy compatibility function
export function generateImportBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}