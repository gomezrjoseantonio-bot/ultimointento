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
        // Try different encodings for CSV files
        let csvText: string;
        try {
          csvText = new TextDecoder('utf-8').decode(fileBuffer);
        } catch {
          try {
            csvText = new TextDecoder('iso-8859-1').decode(fileBuffer);
          } catch {
            csvText = new TextDecoder('windows-1252').decode(fileBuffer);
          }
        }
        
        // Detect CSV separator
        const separators = [',', ';', '\t', '|'];
        let bestSeparator = ',';
        let maxColumns = 0;
        
        for (const sep of separators) {
          const lines = csvText.split('\n').slice(0, 3); // Check first 3 lines
          const avgColumns = lines.reduce((sum, line) => sum + line.split(sep).length, 0) / lines.length;
          if (avgColumns > maxColumns) {
            maxColumns = avgColumns;
            bestSeparator = sep;
          }
        }
        
        console.log(`Using CSV separator: "${bestSeparator}"`);
        workbook = XLSX.read(csvText, { type: 'string', FS: bestSeparator });
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
      const mappingResult = this.detectColumnMapping(jsonData);

      if (!mappingResult) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          requiresMapping: true,
          error: 'No se pudieron mapear las columnas automáticamente',
          suggestedMapping: this.suggestMapping(jsonData)
        };
      }

      // Parse movements (mappingResult now includes headerRowIndex)
      const movements = this.parseMovements(jsonData, mappingResult.mapping, mappingResult.headerRowIndex);

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

    // Search in first 15 rows for IBAN/account info (more comprehensive)
    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      for (const cell of row) {
        if (typeof cell !== 'string') continue;

        const cellUpper = cell.toUpperCase();

        // Look for IBAN patterns (more flexible)
        const ibanMatch = cellUpper.match(/ES\d{22}/);
        if (ibanMatch && !result.iban) {
          result.iban = ibanMatch[0];
          console.log('Found IBAN in data:', result.iban);
        }

        // Look for account number patterns (various formats)
        const accountPatterns = [
          /\d{20}/, // Standard 20-digit format
          /\d{4}[-\s]\d{4}[-\s]\d{2}[-\s]\d{10}/, // Formatted account
          /ES\d{2}[-\s]\d{4}[-\s]\d{4}[-\s]\d{2}[-\s]\d{10}/ // Full IBAN formatted
        ];

        for (const pattern of accountPatterns) {
          const accountMatch = cell.match(pattern);
          if (accountMatch && !result.account) {
            result.account = accountMatch[0].replace(/[-\s]/g, '');
            console.log('Found account in data:', result.account);
            break;
          }
        }

        // Look for account references in headers/metadata
        if (cellUpper.includes('CUENTA') || cellUpper.includes('ACCOUNT') || cellUpper.includes('IBAN')) {
          const nextCellIndex = row.indexOf(cell) + 1;
          if (nextCellIndex < row.length && row[nextCellIndex]) {
            const nextCell = String(row[nextCellIndex]);
            const potentialAccount = nextCell.match(/ES\d{22}|\d{20}/);
            if (potentialAccount) {
              if (potentialAccount[0].startsWith('ES')) {
                result.iban = potentialAccount[0];
              } else {
                result.account = potentialAccount[0];
              }
            }
          }
        }
      }
    }

    console.log('Account detection result:', result);
    return result;
  }

  private detectColumnMapping(data: any[][]): { mapping: ColumnMapping; headerRowIndex: number } | null {
    if (data.length < 2) return null;

    // Try to find headers in the first few rows
    let headerRowIndex = 0;
    let headers: any[] = [];
    
    // Look for the row that contains the most text-like headers
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      const textCells = row.filter(cell => 
        typeof cell === 'string' && 
        cell.trim().length > 0 && 
        !cell.match(/^\d+([.,]\d+)?$/) // Not just numbers
      );
      
      if (textCells.length >= 3) { // Need at least 3 meaningful headers
        headers = row;
        headerRowIndex = i;
        break;
      }
    }

    if (headers.length === 0) {
      console.warn('No suitable header row found');
      return null;
    }

    const mapping: Partial<ColumnMapping> = {};

    // Common header patterns (more comprehensive)
    const datePatterns = ['fecha', 'date', 'valor', 'operacion', 'fec', 'dt', 'fecha_operacion', 'fecha_valor'];
    const descriptionPatterns = ['concepto', 'descripcion', 'description', 'detalle', 'referencia', 'desc', 'movimiento', 'operacion'];
    const amountPatterns = ['importe', 'amount', 'cantidad', 'valor', 'euros', 'eur', 'debe', 'haber', 'cargo', 'abono'];
    const balancePatterns = ['saldo', 'balance', 'disponible', 'bal', 'saldo_final'];

    headers.forEach((header: any, index: number) => {
      if (typeof header !== 'string') return;
      
      const headerLower = header.toLowerCase().trim();

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
      console.log('Detected column mapping:', mapping, 'at row', headerRowIndex);
      return { 
        mapping: mapping as ColumnMapping, 
        headerRowIndex 
      };
    }

    console.warn('Could not detect all required columns:', mapping);
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

  private parseMovements(data: any[][], mapping: ColumnMapping, headerRowIndex: number = 0): BankMovement[] {
    const movements: BankMovement[] = [];

    // Skip header row(s) - start from the row after the detected header
    const startRow = headerRowIndex + 1;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // Skip rows that look like headers or totals
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell.includes('total') || firstCell.includes('suma') || 
          firstCell.includes('fecha') || firstCell.includes('date')) {
        continue;
      }

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

    console.log(`Parsed ${movements.length} movements from ${data.length - startRow} data rows`);
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