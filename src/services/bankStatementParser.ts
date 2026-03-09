// Bank Statement Parser Service for XLS/XLSX/CSV files
// Implements exact requirements from problem statement

import { safeMatch } from '../utils/safe';

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

      // More permissive validation - allow if either type or extension matches
      const hasValidType = allowedTypes.includes(file.type);
      const hasValidExtension = allowedExtensions.includes(extension || '');

      if (!hasValidType && !hasValidExtension) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          error: `Tipo de archivo no soportado para extracto bancario: ${file.type || 'tipo desconocido'}, extensión: ${extension}`
        };
      }

      console.log(`Processing bank file: ${file.name}, type: ${file.type}, extension: ${extension}`);

      // Dynamic import of XLSX to reduce main bundle size
      const XLSX = await import('xlsx');

      // Read file data
      const fileBuffer = await file.arrayBuffer();
      let workbook: any;

      if (extension === 'csv') {
        // Enhanced CSV processing with better encoding detection
        let csvText: string;
        try {
          // Try UTF-8 first
          csvText = new TextDecoder('utf-8').decode(fileBuffer);
          console.log('Successfully decoded as UTF-8');
        } catch {
          try {
            // Try Windows-1252 (common in Spanish banks)
            csvText = new TextDecoder('windows-1252').decode(fileBuffer);
            console.log('Successfully decoded as Windows-1252');
          } catch {
            try {
              // Try ISO-8859-1 as fallback
              csvText = new TextDecoder('iso-8859-1').decode(fileBuffer);
              console.log('Successfully decoded as ISO-8859-1');
            } catch {
              throw new Error('No se pudo decodificar el archivo CSV con ninguna codificación soportada');
            }
          }
        }
        
        // Enhanced separator detection
        const separators = [';', ',', '\t', '|'];
        let bestSeparator = ';'; // Default to semicolon for Spanish files
        let maxColumns = 0;
        
        // Test each separator on first 5 lines
        const testLines = csvText.split('\n').slice(0, 5);
        for (const sep of separators) {
          let totalColumns = 0;
          let lineCount = 0;
          
          for (const line of testLines) {
            if (line.trim()) {
              const columns = line.split(sep).length;
              totalColumns += columns;
              lineCount++;
            }
          }
          
          const avgColumns = lineCount > 0 ? totalColumns / lineCount : 0;
          
          if (avgColumns > maxColumns && avgColumns >= 3) { // Need at least 3 columns
            maxColumns = avgColumns;
            bestSeparator = sep;
          }
        }
        
        console.log(`Using CSV separator: "${bestSeparator}" with avg ${maxColumns} columns`);
        workbook = XLSX.read(csvText, { type: 'string', FS: bestSeparator });
      } else {
        // Enhanced XLS/XLSX processing
        try {
          // Try with default options first
          workbook = XLSX.read(fileBuffer, { 
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: false
          });
          console.log('Successfully parsed XLS/XLSX file');
        } catch (error) {
          console.warn('Standard parsing failed, trying with compatibility mode:', error);
          // Try with compatibility options for older formats
          workbook = XLSX.read(fileBuffer, { 
            type: 'array',
            cellDates: false,
            cellNF: false,
            cellText: true
          });
        }
      }

      // Log workbook info
      console.log(`Workbook has ${workbook.SheetNames.length} sheets:`, workbook.SheetNames);

      // Get first worksheet (or find the best one)
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      if (!worksheet) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          error: 'No se pudo acceder a la hoja de cálculo'
        };
      }

      // Convert to JSON with range detection
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
      console.log(`Worksheet range: ${range.s.r}-${range.e.r} rows, ${range.s.c}-${range.e.c} columns`);

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false, // Get formatted strings
        dateNF: 'dd/mm/yyyy', // Spanish date format
        defval: '' // Default value for empty cells
      }) as any[][];

      console.log(`Extracted ${jsonData.length} rows of data`);

      if (jsonData.length < 2) {
        return {
          success: false,
          movements: [],
          totalMovements: 0,
          error: 'El archivo no contiene suficientes datos'
        };
      }

      // Enhanced account/IBAN detection
      const detectionResult = this.detectAccountInfo(jsonData, file.name);
      console.log('Account detection result:', detectionResult);

      // Enhanced column mapping
      const mappingResult = this.detectColumnMapping(jsonData);
      console.log('Column mapping result:', mappingResult);

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

      // Parse movements with enhanced error handling
      const movements = this.parseMovements(jsonData, mappingResult.mapping, mappingResult.headerRowIndex, XLSX);
      console.log(`Successfully parsed ${movements.length} movements`);

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

    console.log('Starting account detection...');

    // Enhanced filename search for Santander and other banks
    const filenameUpper = filename.toUpperCase();
    console.log('Analyzing filename:', filenameUpper);

    // Look for IBAN in filename (more patterns)
    const ibanPatterns = [
      /ES\d{22}/g,
      /ES\d{2}\s?\d{4}\s?\d{4}\s?\d{2}\s?\d{10}/g,
      /ES\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{2}[-\s]?\d{10}/g
    ];

    for (const pattern of ibanPatterns) {
      const ibanMatch = safeMatch(filenameUpper, pattern);
      if (ibanMatch) {
        result.iban = ibanMatch[0].replace(/[-\s]/g, '');
        console.log('Found IBAN in filename:', result.iban);
        break;
      }
    }

    // Look for account numbers in filename
    const accountPatterns = [
      /\d{20}/g, // Standard 20-digit format
      /\d{4}[-\s]?\d{4}[-\s]?\d{2}[-\s]?\d{10}/g, // Formatted account
      /(?:CUENTA|ACCOUNT|CTA)[-\s]?(\d{10,20})/gi,
      /(?:SANTANDER|BBVA|ING|CAIXA)[-\s]?(\d{10,20})/gi
    ];

    for (const pattern of accountPatterns) {
      const accountMatch = safeMatch(filenameUpper, pattern);
      if (accountMatch) {
        const account = accountMatch[0].replace(/[-\s]/g, '').replace(/[A-Z]/g, '');
        if (account.length >= 10) {
          result.account = account;
          console.log('Found account in filename:', result.account);
          break;
        }
      }
    }

    // Enhanced search in data (look in more rows and with better patterns)
    const searchRows = Math.min(20, data.length); // Search more rows
    console.log(`Searching in first ${searchRows} rows of data...`);

    for (let i = 0; i < searchRows; i++) {
      const row = data[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (typeof cell !== 'string') continue;

        const cellUpper = cell.toUpperCase();
        const cellClean = cell.replace(/\s+/g, '');

        // Enhanced IBAN detection (multiple patterns)
        if (!result.iban) {
          for (const pattern of ibanPatterns) {
            const ibanMatch = safeMatch(cellClean, pattern);
            if (ibanMatch) {
              result.iban = ibanMatch[0].replace(/[-\s]/g, '');
              console.log(`Found IBAN in data[${i}][${j}]:`, result.iban);
              break;
            }
          }
        }

        // Enhanced account detection
        if (!result.account) {
          // Look for account number patterns
          const accountMatches = [
            safeMatch(cellClean, /^\d{20}$/), // Exact 20 digits
            safeMatch(cellClean, /^\d{4}\d{4}\d{2}\d{10}$/), // Standard format
            safeMatch(cellClean, /\d{10,20}/), // 10-20 digits anywhere
          ];

          for (const match of accountMatches) {
            if (match && match[0].length >= 10) {
              result.account = match[0];
              console.log(`Found account in data[${i}][${j}]:`, result.account);
              break;
            }
          }
        }

        // Look for headers that indicate account info in next cell
        const accountHeaders = [
          'CUENTA', 'ACCOUNT', 'CTA', 'IBAN', 'NUMERO', 'NUMBER',
          'ENTIDAD', 'BANCO', 'BANK', 'SANTANDER', 'BBVA', 'ING'
        ];

        if (accountHeaders.some(header => cellUpper.includes(header))) {
          // Check adjacent cells for account/IBAN
          const adjacentCells = [
            row[j + 1], // Next cell in same row
            row[j + 2], // Two cells ahead
            data[i + 1] ? data[i + 1][j] : null, // Same column, next row
            data[i + 1] ? data[i + 1][j + 1] : null // Next column, next row
          ];

          for (const adjCell of adjacentCells) {
            if (typeof adjCell === 'string') {
              const adjClean = adjCell.replace(/\s+/g, '');
              
              // Check for IBAN in adjacent cell
              if (!result.iban) {
                for (const pattern of ibanPatterns) {
                  const ibanMatch = safeMatch(adjClean, pattern);
                  if (ibanMatch) {
                    result.iban = ibanMatch[0].replace(/[-\s]/g, '');
                    console.log(`Found IBAN near header "${cell}":`, result.iban);
                    break;
                  }
                }
              }

              // Check for account in adjacent cell
              if (!result.account) {
                const accountMatch = safeMatch(adjClean, /\d{10,20}/);
                if (accountMatch) {
                  result.account = accountMatch[0];
                  console.log(`Found account near header "${cell}":`, result.account);
                }
              }
            }
          }
        }

        // Break early if we found both
        if (result.iban && result.account) {
          console.log('Found both IBAN and account, stopping search');
          break;
        }
      }

      if (result.iban && result.account) break;
    }

    // If we have IBAN but no account, derive account from IBAN
    if (result.iban && !result.account) {
      // Spanish IBAN format: ES + 2 check digits + 20 digit account
      if (result.iban.startsWith('ES') && result.iban.length === 24) {
        result.account = result.iban.slice(4); // Last 20 digits
        console.log('Derived account from IBAN:', result.account);
      }
    }

    console.log('Final account detection result:', result);
    return result;
  }

  private detectColumnMapping(data: any[][]): { mapping: ColumnMapping; headerRowIndex: number } | null {
    if (data.length < 2) return null;

    console.log('Starting column mapping detection...');

    // Try to find headers in the first few rows
    let headerRowIndex = 0;
    let headers: any[] = [];
    
    // Look for the row that contains the most text-like headers (enhanced for Spanish banks)
    for (let i = 0; i < Math.min(10, data.length); i++) { // Search more rows
      const row = data[i];
      if (!row) continue;
      
      // Count meaningful headers (text that's not just numbers or dates)
      const meaningfulHeaders = row.filter(cell => {
        if (typeof cell !== 'string') return false;
        const cellUpper = cell.toUpperCase().trim();
        
        // Skip empty, purely numeric, or date-like cells
        if (!cellUpper || /^\d+([.,]\d+)?$/.test(cellUpper) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(cellUpper)) {
          return false;
        }
        
        // Common header keywords for Spanish banks
        const headerKeywords = [
          'FECHA', 'DATE', 'CONCEPTO', 'DESCRIPCION', 'DESCRIPTION', 'DETALLE',
          'IMPORTE', 'AMOUNT', 'CANTIDAD', 'VALOR', 'EUROS', 'EUR', 'SALDO',
          'BALANCE', 'DEBE', 'HABER', 'CARGO', 'ABONO', 'MOVIMIENTO',
          'OPERACION', 'REFERENCIA', 'REF', 'TIPO', 'TYPE', 'OFICINA',
          'CUENTA', 'ACCOUNT', 'NUMERO', 'NUM', 'SANTANDER', 'BBVA'
        ];
        
        // Check if cell contains header-like keywords
        return headerKeywords.some(keyword => cellUpper.includes(keyword)) || cellUpper.length >= 4;
      });
      
      console.log(`Row ${i}: ${meaningfulHeaders.length} meaningful headers:`, meaningfulHeaders);
      
      if (meaningfulHeaders.length >= 3) { // Need at least 3 meaningful headers
        headers = row;
        headerRowIndex = i;
        console.log(`Selected header row ${i}:`, headers);
        break;
      }
    }

    if (headers.length === 0) {
      console.warn('No suitable header row found');
      return null;
    }

    const mapping: Partial<ColumnMapping> = {};

    // Enhanced header patterns for Spanish banks (especially Santander)
    const datePatterns = [
      'fecha', 'date', 'valor', 'operacion', 'fec', 'dt', 'fecha_operacion', 
      'fecha_valor', 'f.valor', 'f.operacion', 'f_valor', 'f_operacion'
    ];
    
    const descriptionPatterns = [
      'concepto', 'descripcion', 'description', 'detalle', 'referencia', 
      'desc', 'movimiento', 'operacion', 'texto', 'observaciones', 'obs',
      'descripcion_operacion', 'concepto_operacion', 'denominacion'
    ];
    
    const balancePatterns = [
      'saldo', 'balance', 'disponible', 'bal', 'saldo_final', 'saldo_posterior',
      'saldo_actual', 'saldo_disponible', 'disponible_final'
    ];

    headers.forEach((header: any, index: number) => {
      if (typeof header !== 'string') return;
      
      const headerLower = header.toLowerCase().trim();
      console.log(`Analyzing header ${index}: "${headerLower}"`);

      // Date column detection
      if (!mapping.dateColumn && datePatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.dateColumn = index;
        console.log(`Found date column at index ${index}: "${header}"`);
      }

      // Description column detection
      if (!mapping.descriptionColumn && descriptionPatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.descriptionColumn = index;
        console.log(`Found description column at index ${index}: "${header}"`);
      }

      // Amount column detection (prefer specific patterns first)
      if (!mapping.amountColumn) {
        // Priority patterns for amount
        const priorityAmountPatterns = ['importe', 'cantidad', 'valor', 'euros', 'eur'];
        const secondaryAmountPatterns = ['debe', 'haber', 'cargo', 'abono'];
        
        if (priorityAmountPatterns.some(pattern => headerLower.includes(pattern))) {
          mapping.amountColumn = index;
          console.log(`Found amount column at index ${index}: "${header}"`);
        } else if (!mapping.amountColumn && secondaryAmountPatterns.some(pattern => headerLower.includes(pattern))) {
          mapping.amountColumn = index;
          console.log(`Found amount column (secondary) at index ${index}: "${header}"`);
        }
      }

      // Balance column detection
      if (!mapping.balanceColumn && balancePatterns.some(pattern => headerLower.includes(pattern))) {
        mapping.balanceColumn = index;
        console.log(`Found balance column at index ${index}: "${header}"`);
      }
    });

    // Fallback logic: if we didn't find some columns, try positional heuristics
    if (!mapping.dateColumn || !mapping.descriptionColumn || !mapping.amountColumn) {
      console.log('Using fallback heuristics for missing columns...');
      
      // Analyze first few data rows to identify column types
      const sampleDataRows = data.slice(headerRowIndex + 1, headerRowIndex + 6); // Next 5 rows
      
      for (let colIndex = 0; colIndex < headers.length; colIndex++) {
        const columnSample = sampleDataRows.map(row => row[colIndex]).filter(cell => cell != null && cell !== '');
        
        if (columnSample.length === 0) continue;
        
        // Check if column contains dates
        if (!mapping.dateColumn) {
          const dateCount = columnSample.filter(cell => {
            if (typeof cell !== 'string') return false;
            return /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(cell) || 
                   /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell);
          }).length;
          
          if (dateCount >= columnSample.length * 0.6) { // 60% date-like
            mapping.dateColumn = colIndex;
            console.log(`Found date column by heuristic at index ${colIndex}`);
          }
        }
        
        // Check if column contains amounts (numbers with decimals)
        if (!mapping.amountColumn) {
          const numberCount = columnSample.filter(cell => {
            if (typeof cell === 'number') return true;
            if (typeof cell === 'string') {
              return /^-?\d+([.,]\d{1,2})?$/.test(cell.replace(/\s/g, ''));
            }
            return false;
          }).length;
          
          if (numberCount >= columnSample.length * 0.8) { // 80% numeric
            mapping.amountColumn = colIndex;
            console.log(`Found amount column by heuristic at index ${colIndex}`);
          }
        }
        
        // Description is usually the longest text column
        if (!mapping.descriptionColumn) {
          const avgLength = columnSample.reduce((sum, cell) => {
            return sum + String(cell).length;
          }, 0) / columnSample.length;
          
          if (avgLength > 10) { // Average length > 10 chars
            mapping.descriptionColumn = colIndex;
            console.log(`Found description column by heuristic at index ${colIndex} (avg length: ${avgLength})`);
          }
        }
      }
    }

    // Validate that we have essential columns
    const hasRequiredColumns = mapping.dateColumn !== undefined && 
                              mapping.descriptionColumn !== undefined && 
                              mapping.amountColumn !== undefined;

    console.log('Final column mapping:', mapping);
    console.log('Has required columns:', hasRequiredColumns);

    if (hasRequiredColumns) {
      return { 
        mapping: mapping as ColumnMapping, 
        headerRowIndex 
      };
    }

    console.warn('Could not detect all required columns');
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

  private parseMovements(data: any[][], mapping: ColumnMapping, headerRowIndex: number = 0, XLSX?: any): BankMovement[] {
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
          date: this.parseDate(row[mapping.dateColumn], XLSX),
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

  private parseDate(value: any, XLSX?: any): string {
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
        const match = safeMatch(value, format);
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

    // If it's a number (Excel date serial) and XLSX is available
    if (typeof value === 'number' && XLSX?.SSF?.parse_date_code) {
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