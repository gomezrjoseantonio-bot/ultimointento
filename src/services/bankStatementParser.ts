// Bank Statement Parser Service for XLS/XLSX/CSV files
// Implements exact requirements from problem statement

import * as XLSX from 'xlsx';

export interface BankMovement {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type?: 'debit' | 'credit';
}

export interface BankStatementParseResult {
  success: boolean;
  movements: BankMovement[];
  detectedAccount?: string;
  detectedIban?: string;
  totalMovements: number;
  error?: string;
  requiresMapping?: boolean;
  suggestedMapping?: ColumnMapping;
}

export interface ColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
  balanceColumn?: number;
  typeColumn?: number;
}

export class BankStatementParser {
  private static instance: BankStatementParser;
  
  static getInstance(): BankStatementParser {
    if (!BankStatementParser.instance) {
      BankStatementParser.instance = new BankStatementParser();
    }
    return BankStatementParser.instance;
  }

  /**
   * Parse bank statement file (XLS/XLSX/CSV)
   */
  async parseFile(file: File): Promise<BankStatementParseResult> {
    try {
      // Validate file type
      const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv'
      ];

      const allowedExtensions = ['xls', 'xlsx', 'csv'];
      const extension = file.name.toLowerCase().split('.').pop();

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension || '')) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          error: `Tipo de archivo no soportado para extracto bancario: ${file.type}`
        };
      }

      // Read file data
      const fileBuffer = await file.arrayBuffer();
      let workbook: XLSX.WorkBook;

      if (extension === 'csv') {
        const csvText = new TextDecoder().decode(fileBuffer);
        workbook = XLSX.read(csvText, { type: 'string' });
      } else {
        workbook = XLSX.read(fileBuffer, { type: 'array' });
      }

      // Get first worksheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          error: 'El archivo no contiene suficientes datos'
        };
      }

      // Detect account/IBAN in headers or metadata
      const detectionResult = this.detectAccountInfo(jsonData, file.name);

      // Auto-detect column mapping
      const mapping = this.detectColumnMapping(jsonData);

      if (!mapping) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          requiresMapping: true,
          error: 'No se pudieron mapear las columnas automáticamente',
          suggestedMapping: this.suggestMapping(jsonData)
        };
      }

      // Parse movements
      const movements = this.parseMovements(jsonData, mapping);

      return {
        success: true,
        movements,
        totalMovements: movements.length,
        detectedAccount: detectionResult.account,
        detectedIban: detectionResult.iban
      };

    } catch (error) {
      console.error('Bank statement parsing error:', error);
      return {
        success: false,
        movements: [],
        totalMovements: 0,
        error: error instanceof Error ? error.message : 'Error desconocido parseando extracto'
      };
    }
  }

  private detectAccountInfo(data: any[][], filename: string): { account?: string; iban?: string } {
    const result: { account?: string; iban?: string } = {};

    // Search in filename
    const ibanInFilename = filename.match(/ES\d{22}/);
    if (ibanInFilename) {
      result.iban = ibanInFilename[0];
    }

    // Search in first few rows for IBAN/account info
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      for (const cell of row) {
        if (typeof cell !== 'string') continue;

        // Look for IBAN
        const ibanMatch = cell.match(/ES\d{22}/);
        if (ibanMatch && !result.iban) {
          result.iban = ibanMatch[0];
        }

        // Look for account number
        const accountMatch = cell.match(/\d{20}/);
        if (accountMatch && !result.account) {
          result.account = accountMatch[0];
        }
      }
    }

    return result;
  }

  private detectColumnMapping(data: any[][]): ColumnMapping | null {
    if (data.length < 2) return null;

    const headers = data[0];
    if (!headers) return null;

    const mapping: Partial<ColumnMapping> = {};

    // Common header patterns
    const datePatterns = ['fecha', 'date', 'valor', 'operacion'];
    const descriptionPatterns = ['concepto', 'descripcion', 'description', 'detalle', 'referencia'];
    const amountPatterns = ['importe', 'amount', 'cantidad', 'valor', 'euros'];
    const balancePatterns = ['saldo', 'balance', 'disponible'];

    headers.forEach((header: any, index: number) => {
      if (typeof header !== 'string') return;
      
      const headerLower = header.toLowerCase();

      // Date column
      if (!mapping.dateColumn && datePatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.dateColumn = index;
      }

      // Description column
      if (!mapping.descriptionColumn && descriptionPatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.descriptionColumn = index;
      }

      // Amount column
      if (!mapping.amountColumn && amountPatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.amountColumn = index;
      }

      // Balance column
      if (!mapping.balanceColumn && balancePatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.balanceColumn = index;
      }
    });

    // Validate that we have essential columns
    if (mapping.dateColumn !== undefined && 
        mapping.descriptionColumn !== undefined && 
        mapping.amountColumn !== undefined) {
      return mapping as ColumnMapping;
    }

    return null;
  }

  private suggestMapping(data: any[][]): ColumnMapping | undefined {
    if (data.length < 2) return undefined;

    const headers = data[0];
    if (!headers || headers.length < 3) return undefined;

    // Simple heuristic: assume first 3 columns are date, description, amount
    return {
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2,
      balanceColumn: headers.length > 3 ? 3 : undefined
    };
  }

  private parseMovements(data: any[][], mapping: ColumnMapping): BankMovement[] {
    const movements: BankMovement[] = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      try {
        const movement: BankMovement = {
          date: this.parseDate(row[mapping.dateColumn]),
          description: this.parseDescription(row[mapping.descriptionColumn]),
          amount: this.parseAmount(row[mapping.amountColumn])
        };

        // Add balance if available
        if (mapping.balanceColumn !== undefined) {
          movement.balance = this.parseAmount(row[mapping.balanceColumn]);
        }

        // Determine type from amount sign
        movement.type = movement.amount >= 0 ? 'credit' : 'debit';

        // Only add if we have valid data
        if (movement.date && movement.description && !isNaN(movement.amount)) {
          movements.push(movement);
        }

      } catch (error) {
        console.warn(`Error parsing row ${i}:`, error);
        // Continue with next row
      }
    }

    return movements;
  }

  private parseDate(value: any): string {
    if (!value) return '';

    // If it's already a date string
    if (typeof value === 'string') {
      // Try different date formats
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
      ];

      for (const format of formats) {
        const match = value.match(format);
        if (match) {
          const [, p1, p2, p3] = match;
          
          // Determine if it's DD/MM/YYYY or YYYY-MM-DD
          if (p3.length === 4) {
            // DD/MM/YYYY or DD-MM-YYYY
            return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
          } else {
            // YYYY-MM-DD
            return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
          }
        }
      }
    }

    // If it's a number (Excel date serial)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }

    return '';
  }

  private parseDescription(value: any): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value || '').trim();
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      // Remove currency symbols and normalize
      const cleaned = value
        .replace(/[€$]/g, '')
        .replace(/\./g, '') // Remove thousands separator
        .replace(',', '.') // Use dot as decimal separator
        .trim();

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }
}

export const bankStatementParser = BankStatementParser.getInstance();