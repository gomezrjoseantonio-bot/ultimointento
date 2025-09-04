// ATLAS HOTFIX: Robust Bank Statement Parser - XLS/XLSX/CSV with header detection and fallback
import * as XLSX from 'xlsx';
import { ParsedMovement, SheetInfo, HeaderDetectionResult, BankParseResult } from '../../../types/bankProfiles';
import { bankProfilesService } from '../../../services/bankProfilesService';
import { telemetry, qaChecklist } from '../../../services/telemetryService';
import { parseEsNumber } from '../../../utils/numberUtils';
import { detectDuplicates } from '../../../utils/duplicateDetection';

// Global aliases for column detection - covers most Spanish banks
const COLUMN_ALIASES = {
  // Order matters - more specific patterns first
  valueDate: [
    'fecha valor', 'f valor', 'value date', 'f. valor', 'fecha de valor'
  ],
  date: [
    'fecha', 'fecha operacion', 'fecha operación', 
    'f operacion', 'f operación', 'f. operacion', 'f. operación', 'date', 
    'fecha mov', 'fecha movimiento', 'fecha de operacion', 'fecha de operación',
    'completed date' // Revolut
  ],
  amount: [
    'importe', 'importe (€)', 'importe eur', 'cantidad', 'monto', 'valor', 
    'euros', 'eur', 'movimiento', 'saldo movimiento', 'amount'
  ],
  cargo: [
    'cargo', 'cargos', 'debito', 'débito', 'debe', 'debit', 'paid out'
  ],
  abono: [
    'abono', 'abonos', 'credito', 'crédito', 'haber', 'credit', 'paid in'
  ],
  description: [
    'concepto', 'descripcion', 'descripción', 'detalle', 'descripcion ampliada',
    'detalle operacion', 'detalle operación', 'description', 'observaciones',
    'motivo', 'referencia', 'concepto operacion', 'concepto operación',
    'description' // Revolut
  ],
  balance: [
    'saldo', 'saldo disponible', 'saldo tras', 'saldo después', 'balance',
    'saldo final', 'saldo resultante', 'saldo actual'
  ],
  currency: [
    'divisa', 'moneda', 'currency', 'coin', 'curr'
  ],
  reference: [
    'referencia', 'ref', 'numero operacion', 'número operación', 'reference',
    'num operacion', 'núm operación', 'id operacion', 'id operación'
  ]
};

export class BankParserService {
  
  /**
   * Parse bank statement file - supports XLS/XLSX/CSV with robust detection
   */
  async parseFile(file: File): Promise<BankParseResult> {
    const operationId = telemetry.bankParseStart(file.name, file.size);
    const startTime = Date.now();
    
    try {
      const fileType = this.detectFileType(file);
      let workbook: XLSX.WorkBook;
      
      // QA: Test file format support
      qaChecklist.bankParsing.fileSupport([fileType]);
      
      if (fileType === 'csv') {
        const text = await this.readFileAsText(file);
        workbook = this.parseCSVEnhanced(text);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const buffer = await this.readFileAsArrayBuffer(file);
        workbook = XLSX.read(buffer, { type: 'array' });
      } else {
        throw new Error(`Formato no soportado: ${file.type}`);
      }

      // Get sheet information
      const sheetInfo = this.getSheetInfo(workbook);
      
      // Auto-select best sheet (first with data)
      const bestSheet = sheetInfo.find(s => s.hasData) || sheetInfo[0];
      if (!bestSheet) {
        throw new Error('No se encontraron hojas con datos');
      }

      const parseResult = await this.parseSheet(workbook, bestSheet.name);
      const parseTime = Date.now() - startTime;
      
      // Telemetry for successful parse
      telemetry.bankParseComplete(operationId, {
        fileName: file.name,
        fileSize: file.size,
        parseTimeMs: parseTime,
        bankDetected: parseResult.metadata?.bankKey || null,
        confidence: parseResult.metadata?.confidence || 0,
        movementsCount: parseResult.movements.length,
        needsManualMapping: !!parseResult.needsManualMapping,
        sheetsCount: sheetInfo.length,
        headerRow: parseResult.metadata?.headerRow,
        columnsDetected: parseResult.metadata?.columnsDetected
      });
      
      // QA: Test header detection
      if (parseResult.headerDetection) {
        qaChecklist.bankParsing.headerDetection(
          !parseResult.headerDetection.fallbackRequired,
          parseResult.headerDetection.confidence
        );
      }
      
      // QA: Test Spanish normalization (sample movement)
      if (parseResult.movements.length > 0) {
        const sampleMovement = parseResult.movements[0];
        qaChecklist.bankParsing.spanishNormalization(
          sampleMovement.date.toLocaleDateString('es-ES'),
          new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(sampleMovement.amount)
        );
      }
      
      return {
        ...parseResult,
        sheetInfo,
        selectedSheet: bestSheet.name,
        success: true
      };
      
    } catch (error) {
      console.error('Bank parse error:', error);
      telemetry.bankParseError(operationId, error instanceof Error ? error.message : 'Unknown error', file.name);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        movements: [],
        metadata: {}
      };
    }
  }

  /**
   * Preview bank statement file - returns first 5 rows with bank detection and total count
   */
  async previewFile(file: File): Promise<{
    success: boolean;
    bankDetected?: string;
    confidence?: number;
    totalRows: number;
    previewRows: any[];
    totalMovements: number;
    duplicateCount?: number; // Add duplicate count to type
    error?: string;
    needsManualMapping?: boolean;
    availableColumns?: string[];
  }> {
    try {
      const fileType = this.detectFileType(file);
      let workbook: XLSX.WorkBook;
      
      if (fileType === 'csv') {
        const text = await this.readFileAsText(file);
        workbook = this.parseCSVEnhanced(text);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const buffer = await this.readFileAsArrayBuffer(file);
        workbook = XLSX.read(buffer, { type: 'array' });
      } else {
        throw new Error(`Formato no soportado: ${file.type}`);
      }

      // Get sheet information and select best sheet
      const sheetInfo = this.getSheetInfo(workbook);
      const bestSheet = sheetInfo.find(s => s.hasData) || sheetInfo[0];
      if (!bestSheet) {
        throw new Error('No se encontraron hojas con datos');
      }

      const worksheet = workbook.Sheets[bestSheet.name];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '', 
        raw: false 
      }) as string[][];

      // Detect headers and bank
      const headerDetection = this.detectHeaders(rawData);
      const bankDetection = headerDetection.detectedColumns && Object.keys(headerDetection.detectedColumns).length > 0
        ? await bankProfilesService.detectBank(rawData[headerDetection.headerRow] || [])
        : null;

      // Get preview rows (headers + first 5 data rows)
      const headerRow = headerDetection.headerRow;
      const previewRows = [];
      
      // Add header row
      if (rawData[headerRow]) {
        previewRows.push({
          rowType: 'header',
          data: rawData[headerRow]
        });
      }
      
      // Add up to 5 data rows for preview
      const maxPreview = Math.min(headerRow + 6, rawData.length);
      for (let i = headerRow + 1; i < maxPreview; i++) {
        if (rawData[i] && rawData[i].some(cell => cell && cell.toString().trim())) {
          previewRows.push({
            rowType: 'data',
            data: rawData[i]
          });
        }
      }

      // Parse all movements to get accurate count and duplicate detection
      let totalMovements = 0;
      let duplicateCount = 0;
      
      if (!headerDetection.fallbackRequired && headerDetection.detectedColumns) {
        try {
          const movements = this.parseMovements(rawData, headerDetection.dataStartRow, headerDetection.detectedColumns);
          totalMovements = movements.length;
          duplicateCount = movements.filter(m => m.isDuplicate).length;
        } catch (error) {
          console.warn('Error parsing movements for preview:', error);
          // Fallback to simple row count
          totalMovements = Math.max(0, rawData.length - headerRow - 1);
        }
      } else {
        // Fallback to simple row count when manual mapping needed
        totalMovements = Math.max(0, rawData.length - headerRow - 1);
      }

      return {
        success: true,
        bankDetected: bankDetection?.bankKey,
        confidence: bankDetection?.confidence,
        totalRows: rawData.length,
        previewRows,
        totalMovements,
        duplicateCount, // Add duplicate count for preview
        needsManualMapping: !bankDetection || headerDetection.fallbackRequired,
        availableColumns: rawData[headerRow] || []
      };

    } catch (error) {
      console.error('Bank preview error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        totalRows: 0,
        previewRows: [],
        totalMovements: 0,
        duplicateCount: 0
      };
    }
  }

  /**
   * Parse specific sheet with header detection and fallback
   */
  async parseSheet(workbook: XLSX.WorkBook, sheetName: string): Promise<BankParseResult> {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Hoja '${sheetName}' no encontrada`);
    }

    // Convert to array of arrays for easier processing
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '',
      raw: false // Convert numbers/dates to strings for consistent processing
    }) as string[][];

    if (rawData.length === 0) {
      throw new Error('La hoja no contiene datos');
    }

    // Detect headers and data start
    const headerDetection = this.detectHeaders(rawData);
    
    if (headerDetection.fallbackRequired) {
      return {
        success: true,
        movements: [],
        metadata: {
          rawData: rawData.slice(0, Math.min(10, rawData.length)), // First 10 rows for preview
          headerDetection,
          needsManualMapping: true
        },
        needsManualMapping: true,
        headerDetection
      };
    }

    // Parse movements using detected columns
    const movements = this.parseMovements(
      rawData, 
      headerDetection.dataStartRow, 
      headerDetection.detectedColumns
    );

    // Try to detect bank profile
    const headerRow = rawData[headerDetection.headerRow] || [];
    const bankDetection = await bankProfilesService.detectBank(headerRow);

    return {
      success: true,
      movements,
      metadata: {
        bankKey: bankDetection?.bankKey,
        bankName: bankDetection?.bankName,
        confidence: bankDetection?.confidence || headerDetection.confidence,
        headerRow: headerDetection.headerRow,
        dataStartRow: headerDetection.dataStartRow,
        rowsProcessed: rawData.length - headerDetection.dataStartRow,
        columnsDetected: Object.keys(headerDetection.detectedColumns).length
      },
      headerDetection
    };
  }

  /**
   * Detect file type from file object
   */
  private detectFileType(file: File): 'csv' | 'xlsx' | 'xls' {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    
    if (name.endsWith('.csv') || type.includes('csv')) return 'csv';
    if (name.endsWith('.xlsx') || type.includes('spreadsheet')) return 'xlsx';
    if (name.endsWith('.xls') || type.includes('excel')) return 'xls';
    
    // Default to xlsx for unknown Excel-like files
    return 'xlsx';
  }

  /**
   * Parse CSV with smart delimiter detection
   */
  private parseCSV(text: string): XLSX.WorkBook {
    // Detect delimiter (comma, semicolon, tab)
    const delimiters = [',', ';', '\t'];
    let bestDelimiter = ',';
    let maxColumns = 0;

    for (const delimiter of delimiters) {
      const lines = text.split('\n').slice(0, 5); // Check first 5 lines
      const avgColumns = lines.reduce((sum, line) => sum + line.split(delimiter).length, 0) / lines.length;
      if (avgColumns > maxColumns) {
        maxColumns = avgColumns;
        bestDelimiter = delimiter;
      }
    }

    return XLSX.read(text, { type: 'string', FS: bestDelimiter });
  }

  /**
   * Enhanced CSV parsing with improved delimiter detection and European decimal support
   */
  private parseCSVEnhanced(text: string): XLSX.WorkBook {
    // Detect delimiter more robustly
    const delimiters = [',', ';', '\t', '|'];
    let bestDelimiter = ',';
    let maxScore = 0;

    for (const delimiter of delimiters) {
      const lines = text.split('\n').slice(0, 10); // Check more lines
      let score = 0;
      
      for (const line of lines) {
        const fields = line.split(delimiter);
        // Score based on consistent field count and typical bank data patterns
        if (fields.length >= 3 && fields.length <= 15) { // Reasonable field count
          score += fields.length;
          
          // Bonus for fields that look like dates, amounts, or descriptions
          for (const field of fields) {
            const trimmed = field.trim();
            // Date patterns
            if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) score += 2;
            // Amount patterns (European format)
            if (/^-?[\d.,]+\s*€?$/.test(trimmed)) score += 2;
            // Long description patterns
            if (trimmed.length > 10 && /[a-zA-Z]/.test(trimmed)) score += 1;
          }
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestDelimiter = delimiter;
      }
    }

    console.log(`CSV delimiter detected: "${bestDelimiter}" (score: ${maxScore})`);
    
    return XLSX.read(text, { 
      type: 'string', 
      FS: bestDelimiter,
      raw: false // Enable type inference for better number parsing
    });
  }

  /**
   * Get information about all sheets in workbook
   */
  private getSheetInfo(workbook: XLSX.WorkBook): SheetInfo[] {
    return workbook.SheetNames.map(name => {
      const worksheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const rowCount = range.e.r + 1;
      
      // Check if sheet has meaningful data (more than just headers)
      const hasData = rowCount > 1;
      
      return {
        name,
        rowCount,
        hasData
      };
    });
  }

  /**
   * Robust header detection - scans first 20 rows to find real headers
   * Ignores rows with >40% images/logos/long strings as per requirements
   */
  private detectHeaders(data: string[][]): HeaderDetectionResult {
    const maxScanRows = Math.min(20, data.length); // As per requirements: scan first 20 rows
    
    for (let row = 0; row < maxScanRows; row++) {
      const rowData = data[row];
      if (!rowData || rowData.length < 2) continue;
      
      // Skip rows with >40% cells with images, logos or strings very long without spaces
      if (this.isLogoOrImageRow(rowData)) continue;
      
      const normalizedRow = rowData.map(cell => this.normalizeText(cell));
      const detectedColumns: Record<string, number> = {};
      let score = 0;
      
      // Try to match columns with aliases
      for (let col = 0; col < normalizedRow.length; col++) {
        const cellText = normalizedRow[col];
        
        // Track if this column was already matched to avoid double-matching
        let matched = false;
        
        for (const [columnType, aliases] of Object.entries(COLUMN_ALIASES)) {
          if (!matched && aliases.some(alias => this.normalizeText(alias) === cellText)) {
            detectedColumns[columnType] = col;
            score++;
            matched = true;
            break;
          }
        }
      }
      
      // Valid header row must have at least 3 matches (increased threshold) and include date + amount info
      const hasDateInfo = detectedColumns.date !== undefined || detectedColumns.valueDate !== undefined;
      const hasAmountInfo = detectedColumns.amount !== undefined || 
                           (detectedColumns.cargo !== undefined && detectedColumns.abono !== undefined);
      
      if (score >= 3 && hasDateInfo && hasAmountInfo) {
        return {
          headerRow: row,
          dataStartRow: row + 1,
          detectedColumns,
          confidence: Math.min(score / 6, 1), // Max confidence at 6+ matches
          fallbackRequired: false
        };
      }
    }
    
    // No automatic detection possible - needs manual mapping
    return {
      headerRow: 0,
      dataStartRow: 1,
      detectedColumns: {},
      confidence: 0,
      fallbackRequired: true
    };
  }

  /**
   * Check if row contains logos, images or very long strings without spaces (>40% threshold)
   */
  private isLogoOrImageRow(rowData: string[]): boolean {
    if (!rowData || rowData.length === 0) return true;
    
    let suspiciousCells = 0;
    
    for (const cell of rowData) {
      const cellStr = String(cell || '').trim();
      
      // Empty cells are neutral
      if (!cellStr) continue;
      
      // Very long strings without spaces (likely encoded images/logos)
      if (cellStr.length > 50 && !cellStr.includes(' ')) {
        suspiciousCells++;
        continue;
      }
      
      // Common image/logo indicators
      const logoPatterns = [
        /^data:image/, // Base64 images
        /\.png|\.jpg|\.jpeg|\.gif|\.svg/i, // Image extensions
        /^[A-Za-z0-9+/]{50,}={0,2}$/, // Base64 encoded data
        /^\s*\[imagen\]|\[logo\]|\[image\]/i, // Placeholder text
      ];
      
      if (logoPatterns.some(pattern => pattern.test(cellStr))) {
        suspiciousCells++;
      }
    }
    
    // If >40% of non-empty cells are suspicious, skip this row
    const nonEmptyCells = rowData.filter(cell => String(cell || '').trim()).length;
    if (nonEmptyCells === 0) return true;
    
    return (suspiciousCells / nonEmptyCells) > 0.4;
  }

  /**
   * Parse movements from data using detected column mapping
   */
  private parseMovements(
    data: string[][], 
    startRow: number, 
    columns: Record<string, number>
  ): ParsedMovement[] {
    const movements: ParsedMovement[] = [];
    
    for (let row = startRow; row < data.length; row++) {
      const rowData = data[row];
      if (!rowData || this.isJunkRow(rowData)) continue;
      
      try {
        const movement = this.parseMovementRow(rowData, columns);
        if (movement) {
          movement.originalRow = row; // Track original row number
          movements.push(movement);
        }
      } catch (error) {
        console.warn(`Error parsing row ${row + 1}:`, error);
        // Continue with other rows
      }
    }
    
    // Detect duplicates according to requirements: hash by (date_posted + amount + description_normalized)
    const movementsWithDuplicates = detectDuplicates(movements);
    
    return movementsWithDuplicates;
  }

  /**
   * Parse single movement row
   */
  private parseMovementRow(
    rowData: string[], 
    columns: Record<string, number>
  ): ParsedMovement | null {
    
    // Extract required fields
    const dateCol = columns.date;
    const descCol = columns.description;
    
    if (dateCol === undefined) {
      return null; // Missing required date column
    }
    
    const dateStr = rowData[dateCol]?.trim();
    const description = rowData[descCol]?.trim() || 'Sin descripción';
    
    if (!dateStr) {
      return null; // Missing required data
    }
    
    // Parse and validate date
    const date = this.parseSpanishDate(dateStr);
    if (!date || isNaN(date.getTime())) {
      return null; // Invalid date
    }
    
    // Handle amount parsing - either single amount column or separate cargo/abono
    let amount: number;
    
    if (columns.cargo !== undefined && columns.abono !== undefined) {
      // Banco uses separate cargo/abono columns: amount = abono - cargo
      const cargoStr = rowData[columns.cargo]?.trim() || '0';
      const abonoStr = rowData[columns.abono]?.trim() || '0';
      
      const cargo = this.parseSpanishAmount(cargoStr);
      const abono = this.parseSpanishAmount(abonoStr);
      
      if (isNaN(cargo) && isNaN(abono)) {
        return null; // Both invalid
      }
      
      amount = (isNaN(abono) ? 0 : abono) - (isNaN(cargo) ? 0 : cargo);
    } else if (columns.amount !== undefined) {
      // Single amount column
      const amountStr = rowData[columns.amount]?.trim();
      if (!amountStr) {
        return null; // Missing amount
      }
      
      amount = this.parseSpanishAmount(amountStr);
      if (isNaN(amount)) {
        return null; // Invalid amount
      }
    } else {
      return null; // No amount columns found
    }
    
    // Optional fields
    const valueDateStr = columns.valueDate !== undefined ? rowData[columns.valueDate]?.trim() : undefined;
    const valueDate = valueDateStr ? this.parseSpanishDate(valueDateStr) : undefined;
    const balance = columns.balance !== undefined ? this.parseSpanishAmount(rowData[columns.balance]?.trim() || '') : undefined;
    const reference = columns.reference !== undefined ? rowData[columns.reference]?.trim() : undefined;
    const counterparty = columns.counterparty !== undefined ? rowData[columns.counterparty]?.trim() : undefined;
    const currency = columns.currency !== undefined ? rowData[columns.currency]?.trim() : undefined;
    
    return {
      date,
      amount,
      description,
      valueDate: valueDate || date,
      balance: !isNaN(balance!) ? balance : undefined,
      reference,
      counterparty,
      currency: currency && currency !== 'EUR' ? currency : undefined, // Only store non-EUR currencies
      raw: rowData.join('|') // For debugging
    };
  }

  /**
   * Check if row is junk (totals, separators, etc.)
   */
  private isJunkRow(rowData: string[]): boolean {
    const text = rowData.join(' ').toLowerCase();
    
    // Common junk patterns in Spanish bank statements
    const junkPatterns = [
      /total|suma|subtotal/,
      /saldo inicial|saldo final|saldo anterior/,
      /página|page|hoja/,
      /^[\s\-_=]*$/, // Only whitespace or separators
      /continúa|continuación/,
      /resumen|summary/
    ];
    
    return junkPatterns.some(pattern => pattern.test(text)) || 
           rowData.every(cell => !cell || cell.trim() === '');
  }

  /**
   * Parse Spanish date formats (dd/mm/yyyy, dd-mm-yyyy, etc.)
   */
  private parseSpanishDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Clean the date string
    const cleaned = dateStr.trim().replace(/[^\d/\-.]/g, '');
    
    // Try common Spanish formats
    const formats = [
      /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/, // dd/mm/yyyy
      /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/, // dd/mm/yy
      /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/, // yyyy/mm/dd
    ];
    
    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        let [, part1, part2, part3] = match;
        let day: number, month: number, year: number;
        
        if (part3.length === 4) {
          // yyyy format in part3 - this is dd/mm/yyyy
          day = parseInt(part1);
          month = parseInt(part2);
          year = parseInt(part3);
        } else if (part1.length === 4) {
          // yyyy format in part1 - this is yyyy/mm/dd
          year = parseInt(part1);
          month = parseInt(part2);
          day = parseInt(part3);
        } else {
          // dd/mm/yy - assume 20xx for years 00-30, 19xx for 31-99
          day = parseInt(part1);
          month = parseInt(part2);
          year = parseInt(part3);
          year += year <= 30 ? 2000 : 1900;
        }
        
        // Validate date components
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
          const date = new Date(year, month - 1, day);
          if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Parse Spanish amount format (1.234,56 or -1.234,56)
   */
  private parseSpanishAmount(amountStr: string): number {
    if (!amountStr) return NaN;
    
    const result = parseEsNumber(amountStr);
    return result.value || NaN;
  }

  /**
   * Normalize text for comparison (lowercase, no accents, no punctuation)
   */
  private normalizeText(text: string): string {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Read file as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Read file as array buffer
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse with manual column mapping
   */
  async parseWithManualMapping(
    file: File, 
    sheetName: string, 
    columnMapping: Record<string, number>,
    headerRow: number
  ): Promise<BankParseResult> {
    const operationId = telemetry.manualMappingStart(file.name, 'Auto-detection failed');
    const startTime = Date.now();
    
    try {
      const fileType = this.detectFileType(file);
      let workbook: XLSX.WorkBook;
      
      if (fileType === 'csv') {
        const text = await this.readFileAsText(file);
        workbook = this.parseCSV(text);
      } else {
        const buffer = await this.readFileAsArrayBuffer(file);
        workbook = XLSX.read(buffer, { type: 'array' });
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Hoja '${sheetName}' no encontrada`);
      }

      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        raw: false
      }) as string[][];

      const movements = this.parseMovements(rawData, headerRow + 1, columnMapping);
      const parseTime = Date.now() - startTime;
      
      telemetry.manualMappingComplete(operationId, columnMapping);
      telemetry.measurePerformance('manual_mapping_parse', parseTime, {
        movementsCount: movements.length,
        columnsCount: Object.keys(columnMapping).length
      });
      
      // QA: Test fallback mapping
      qaChecklist.bankParsing.fallbackMapping(true, movements.length > 0);
      
      return {
        success: true,
        movements,
        metadata: {
          bankKey: 'manual',
          bankName: 'Mapeo manual',
          confidence: 1.0,
          headerRow,
          dataStartRow: headerRow + 1,
          rowsProcessed: rawData.length - headerRow - 1,
          columnsDetected: Object.keys(columnMapping).length
        }
      };
      
    } catch (error) {
      console.error('Manual mapping parse error:', error);
      telemetry.bankParseError(operationId, error instanceof Error ? error.message : 'Error en mapeo manual', file.name);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en mapeo manual',
        movements: [],
        metadata: {}
      };
    }
  }
}

export const bankParser = new BankParserService();