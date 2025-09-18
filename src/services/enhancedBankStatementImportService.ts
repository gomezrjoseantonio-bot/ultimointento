/**
 * Enhanced Bank Statement Import Service - Treasury v1.2
 * 
 * Implements robust multi-bank import with auto-mapping, preview, and deduplication
 * as specified in the problem statement requirements
 */

import { universalBankImporter } from './universalBankImporter/universalBankImporter';
import { columnRoleDetector } from './universalBankImporter/columnRoleDetector';
import { dateFormatDetector } from './universalBankImporter/dateFormatDetector';
import { localeDetector } from './universalBankImporter/localeDetector';
import { signDerivationService } from './universalBankImporter/signDerivationService';
import { stableHashDeduplicationService } from './universalBankImporter/stableHashDeduplicationService';
import { initDB, Movement } from './db';
import toast from 'react-hot-toast';

// Logging prefix as specified in requirements
const LOG_PREFIX = '[TESO-IMPORT]';

export interface EnhancedParseResult {
  success: boolean;
  movements: ParsedMovement[];
  totalMovements: number;
  detectedBank?: string;
  detectedIban?: string;
  autoMappingConfidence: number;
  needsManualMapping: boolean;
  previewData: {
    fileName: string;
    totalRows: number;
    previewRows: any[][];
    headers?: string[];
    headerRowIndex: number;
  };
  error?: string;
}

export interface ParsedMovement {
  date: string; // ISO format YYYY-MM-DD
  description: string;
  amount: number;
  balance?: number;
  counterparty?: string;
  reference?: string;
  originalRow: any[];
  confidence: number;
  warnings: string[];
  iban?: string;
}

export interface EnhancedImportOptions {
  file: File;
  destinationAccountId?: number;
  columnMapping?: ColumnMapping;
  usuario?: string;
  skipPreview?: boolean;
}

export interface ColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn?: number;
  debitColumn?: number;
  creditColumn?: number;
  balanceColumn?: number;
  counterpartyColumn?: number;
  referenceColumn?: number;
  ibanColumn?: number;
}

export interface EnhancedImportResult {
  success: boolean;
  inserted: number;
  duplicates: number;
  errors: number;
  createdIds: number[];
  batchId: string;
  processingTimeMs: number;
  // Account selection workflow
  requiresAccountSelection?: boolean;
  detectedIban?: string;
  // Preview workflow
  requiresPreview?: boolean;
  parseResult?: EnhancedParseResult;
}

/**
 * Enhanced parse file with auto-detection and preview generation
 */
export async function parseFileForPreview(file: File): Promise<EnhancedParseResult> {
  console.info(`${LOG_PREFIX} Parse file for preview: ${file.name}, size: ${file.size} bytes`);
  
  try {
    // Step 1: Parse file to raw data
    const rawData = await parseFileToRawData(file);
    console.info(`${LOG_PREFIX} Parsed ${rawData.length} rows from file`);
    
    if (rawData.length === 0) {
      return {
        success: false,
        movements: [],
        totalMovements: 0,
        autoMappingConfidence: 0,
        needsManualMapping: true,
        previewData: {
          fileName: file.name,
          totalRows: 0,
          previewRows: [],
          headerRowIndex: 0
        },
        error: 'No data found in file'
      };
    }

    // Step 2: Detect schema and column mapping
    const schemaDetection = columnRoleDetector.detectSchema(rawData);
    console.info(`${LOG_PREFIX} Schema detection confidence: ${schemaDetection.overallConfidence}`);
    
    // Step 3: Detect bank from filename and content
    const detectedBank = detectBankFromFile(file.name, rawData);
    const detectedIban = detectIbanFromData(rawData);
    
    // Step 4: Generate preview data
    const headerRowIndex = findHeaderRow(rawData);
    const headers = headerRowIndex >= 0 ? rawData[headerRowIndex] : [];
    
    const previewData = {
      fileName: file.name,
      totalRows: rawData.length - (headerRowIndex + 1),
      previewRows: rawData,
      headers: headers.map(h => h?.toString() || ''),
      headerRowIndex
    };

    // Step 5: Parse movements for preview (first 10 rows)
    const movements: ParsedMovement[] = [];
    const dataRows = rawData.slice(headerRowIndex + 1, Math.min(headerRowIndex + 11, rawData.length));
    
    if (schemaDetection.overallConfidence >= 0.7) {
      // Auto-mapping is confident enough
      const mapping = convertSchemaToMapping(schemaDetection);
      
      for (const row of dataRows) {
        try {
          const movement = parseRowToMovement(row, mapping, rawData[0]);
          movements.push(movement);
        } catch (error) {
          console.warn(`${LOG_PREFIX} Error parsing row for preview:`, error);
        }
      }
    }

    return {
      success: true,
      movements,
      totalMovements: previewData.totalRows,
      detectedBank,
      detectedIban,
      autoMappingConfidence: schemaDetection.overallConfidence,
      needsManualMapping: schemaDetection.needsManualMapping || schemaDetection.overallConfidence < 0.7,
      previewData
    };

  } catch (error) {
    console.error(`${LOG_PREFIX} Error parsing file for preview:`, error);
    return {
      success: false,
      movements: [],
      totalMovements: 0,
      autoMappingConfidence: 0,
      needsManualMapping: true,
      previewData: {
        fileName: file.name,
        totalRows: 0,
        previewRows: [],
        headerRowIndex: 0
      },
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Enhanced import with deduplication and robust processing
 */
export async function importBankStatementEnhanced(options: EnhancedImportOptions): Promise<EnhancedImportResult> {
  const { file, destinationAccountId, columnMapping, usuario = 'sistema', skipPreview } = options;
  const startTime = performance.now();
  
  console.info(`${LOG_PREFIX} Enhanced import start: ${file.name}, account: ${destinationAccountId}`);
  
  try {
    // If no preview was done and no mapping provided, require preview first
    if (!skipPreview && !columnMapping) {
      const parseResult = await parseFileForPreview(file);
      return {
        success: false,
        inserted: 0,
        duplicates: 0,
        errors: 0,
        createdIds: [],
        batchId: '',
        processingTimeMs: performance.now() - startTime,
        requiresPreview: true,
        parseResult
      };
    }

    // Require destination account
    if (!destinationAccountId) {
      return {
        success: false,
        inserted: 0,
        duplicates: 0,
        errors: 1,
        createdIds: [],
        batchId: '',
        processingTimeMs: performance.now() - startTime,
        requiresAccountSelection: true
      };
    }

    // Parse file with provided mapping
    const rawData = await parseFileToRawData(file);
    const headerRowIndex = findHeaderRow(rawData);
    const dataRows = rawData.slice(headerRowIndex + 1);
    
    console.info(`${LOG_PREFIX} Processing ${dataRows.length} data rows`);

    // Parse all movements
    const movements: ParsedMovement[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      try {
        const movement = parseRowToMovement(dataRows[i], columnMapping!, rawData[0]);
        movements.push(movement);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Error parsing row ${i + 1}:`, error);
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }

    console.info(`${LOG_PREFIX} Parsed ${movements.length} movements, ${errors.length} errors`);

    // Deduplication
    const movementsForDedup = movements.map(m => ({
      account_id: destinationAccountId,
      value_date: m.date,
      amount: m.amount,
      description: m.description,
      iban: m.iban || ''
    }));

    const deduplicationResult = await stableHashDeduplicationService.deduplicateMovements(movementsForDedup);
    console.info(`${LOG_PREFIX} Deduplication: ${deduplicationResult.uniqueCount} unique, ${deduplicationResult.duplicateCount} duplicates`);

    // Check for existing duplicates in database
    const db = await initDB();
    const existingHashes = new Set<string>();
    
    // Get existing movement hashes for this account (simplified - in real implementation would be more efficient)
    const existingMovements = await db.getAll('movements');
    for (const existing of existingMovements) {
      if (existing.account_id === destinationAccountId) {
        const hash = await stableHashDeduplicationService.generateMovementHash({
          account_id: existing.account_id!,
          value_date: existing.value_date,
          amount: existing.amount,
          description: existing.description,
          iban: existing.iban || ''
        });
        existingHashes.add(hash);
      }
    }

    // Filter out database duplicates
    const newMovements = [];
    let dbDuplicates = 0;

    for (const movement of deduplicationResult.uniqueMovements) {
      const isDuplicate = await stableHashDeduplicationService.isDuplicate(movement, existingHashes);
      if (!isDuplicate) {
        newMovements.push(movement);
      } else {
        dbDuplicates++;
      }
    }

    console.info(`${LOG_PREFIX} After DB deduplication: ${newMovements.length} new, ${dbDuplicates} existing duplicates`);

    // Create movements in database
    const createdIds: number[] = [];
    const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    for (const movementData of newMovements) {
      const movement: Partial<Movement> = {
        account_id: destinationAccountId,
        value_date: movementData.value_date,
        description: movementData.description,
        amount: movementData.amount,
        type: movementData.amount >= 0 ? 'IN' : 'OUT',
        state: 'CONFIRMED',
        source: 'extracto',
        created_at: new Date().toISOString(),
        usuario,
        batch_id: batchId
      };

      try {
        const id = await db.add('movements', movement);
        createdIds.push(id as number);
      } catch (error) {
        console.error(`${LOG_PREFIX} Error creating movement:`, error);
        errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const endTime = performance.now();
    const processingTimeMs = endTime - startTime;

    console.info(`${LOG_PREFIX} Import completed: ${createdIds.length} created, ${deduplicationResult.duplicateCount + dbDuplicates} duplicates, ${errors.length} errors in ${processingTimeMs.toFixed(2)}ms`);

    // Show UI toast
    const totalDuplicates = deduplicationResult.duplicateCount + dbDuplicates;
    if (createdIds.length > 0 || totalDuplicates > 0) {
      toast.success(`Importados: ${createdIds.length} · Duplicados: ${totalDuplicates} · Errores: ${errors.length}`);
    }

    return {
      success: true,
      inserted: createdIds.length,
      duplicates: totalDuplicates,
      errors: errors.length,
      createdIds,
      batchId,
      processingTimeMs
    };

  } catch (error) {
    const endTime = performance.now();
    console.error(`${LOG_PREFIX} Import error:`, error);
    
    return {
      success: false,
      inserted: 0,
      duplicates: 0,
      errors: 1,
      createdIds: [],
      batchId: '',
      processingTimeMs: endTime - startTime,
      parseResult: {
        success: false,
        movements: [],
        totalMovements: 0,
        autoMappingConfidence: 0,
        needsManualMapping: true,
        previewData: {
          fileName: file.name,
          totalRows: 0,
          previewRows: [],
          headerRowIndex: 0
        },
        error: error instanceof Error ? error.message : 'Unknown import error'
      }
    };
  }
}

/**
 * Parse file to raw 2D array data
 */
async function parseFileToRawData(file: File): Promise<any[][]> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv') || fileType.includes('csv')) {
    return parseCSVFile(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileType.includes('spreadsheet')) {
    return parseExcelFile(file);
  } else {
    throw new Error('Unsupported file type. Only CSV, XLS, and XLSX files are supported.');
  }
}

/**
 * Parse CSV file
 */
async function parseCSVFile(file: File): Promise<any[][]> {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  return lines.map(line => {
    // Simple CSV parsing - in production would use a proper CSV parser
    const cells = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    cells.push(current.trim());
    return cells;
  });
}

/**
 * Parse Excel file
 */
async function parseExcelFile(file: File): Promise<any[][]> {
  // Dynamic import to avoid bundle bloat
  const XLSX = await import('xlsx');
  
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return data as any[][];
}

/**
 * Detect bank from filename and content patterns
 */
function detectBankFromFile(fileName: string, data: any[][]): string | undefined {
  const lowerName = fileName.toLowerCase();
  
  // Filename patterns
  if (lowerName.includes('santander')) return 'Banco Santander';
  if (lowerName.includes('bbva')) return 'BBVA';
  if (lowerName.includes('sabadell')) return 'Banco Sabadell';
  if (lowerName.includes('unicaja')) return 'Unicaja Banco';
  if (lowerName.includes('caixa') || lowerName.includes('lacaixa')) return 'CaixaBank';
  if (lowerName.includes('ing')) return 'ING';
  
  // Content patterns (first few rows)
  const contentText = data.slice(0, 5).flat().join(' ').toLowerCase();
  if (contentText.includes('santander')) return 'Banco Santander';
  if (contentText.includes('bbva')) return 'BBVA';
  if (contentText.includes('sabadell')) return 'Banco Sabadell';
  if (contentText.includes('unicaja')) return 'Unicaja Banco';
  if (contentText.includes('caixabank') || contentText.includes('la caixa')) return 'CaixaBank';
  
  return undefined;
}

/**
 * Detect IBAN from data content
 */
function detectIbanFromData(data: any[][]): string | undefined {
  // Look for IBAN patterns in first few rows
  const ibanRegex = /ES\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/i;
  
  for (const row of data.slice(0, 10)) {
    for (const cell of row) {
      if (typeof cell === 'string') {
        const match = cell.match(ibanRegex);
        if (match) {
          return match[0].replace(/\s/g, '');
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Find header row index
 */
function findHeaderRow(data: any[][]): number {
  // Look for row with most string headers in first 20 rows
  let bestIndex = 0;
  let bestScore = 0;
  
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    let score = 0;
    
    for (const cell of row) {
      if (typeof cell === 'string' && cell.trim() && !/^\d+$/.test(cell.trim())) {
        score++;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  
  return bestIndex;
}

/**
 * Convert schema detection to column mapping
 */
function convertSchemaToMapping(schema: any): ColumnMapping {
  const mapping: ColumnMapping = {
    dateColumn: -1,
    descriptionColumn: -1
  };

  Object.entries(schema.columns).forEach(([colIndexStr, result]: [string, any]) => {
    const colIndex = parseInt(colIndexStr);
    
    switch (result.role) {
      case 'date':
        mapping.dateColumn = colIndex;
        break;
      case 'description':
        mapping.descriptionColumn = colIndex;
        break;
      case 'amount':
        mapping.amountColumn = colIndex;
        break;
      case 'debit':
        mapping.debitColumn = colIndex;
        break;
      case 'credit':
        mapping.creditColumn = colIndex;
        break;
      case 'balance':
        mapping.balanceColumn = colIndex;
        break;
      case 'counterparty':
        mapping.counterpartyColumn = colIndex;
        break;
      case 'reference':
        mapping.referenceColumn = colIndex;
        break;
    }
  });

  return mapping;
}

/**
 * Parse single row to movement
 */
function parseRowToMovement(row: any[], mapping: ColumnMapping, headerRow?: any[]): ParsedMovement {
  const warnings: string[] = [];
  
  // Parse date
  let date = '';
  try {
    const dateValue = row[mapping.dateColumn];
    if (dateValue) {
      const parsed = dateFormatDetector.parseDate(dateValue.toString());
      if (parsed) {
        date = parsed.date.toISOString().split('T')[0];
      } else {
        warnings.push('Invalid date format');
        date = 'Invalid Date';
      }
    }
  } catch (error) {
    warnings.push('Date parsing error');
    date = 'Invalid Date';
  }

  // Parse description
  const description = row[mapping.descriptionColumn]?.toString().trim() || 'No description';

  // Parse amount using sign derivation service
  let amount = 0;
  try {
    const locale = localeDetector.getDefaultSpanishLocale();
    
    const values: any = {};
    if (mapping.amountColumn !== undefined) {
      values.amount = row[mapping.amountColumn];
    }
    if (mapping.debitColumn !== undefined) {
      values.debit = row[mapping.debitColumn];
    }
    if (mapping.creditColumn !== undefined) {
      values.credit = row[mapping.creditColumn];
    }
    
    const signResult = signDerivationService.deriveSignedAmount(values, locale);
    amount = signResult.amount;
    
    if (signResult.confidence < 0.5) {
      warnings.push('Low confidence in amount parsing');
    }
  } catch (error) {
    warnings.push('Amount parsing error');
  }

  // Parse optional fields
  const balance = mapping.balanceColumn !== undefined ? 
    parseOptionalNumber(row[mapping.balanceColumn]) : undefined;
  
  const counterparty = mapping.counterpartyColumn !== undefined ?
    row[mapping.counterpartyColumn]?.toString().trim() : undefined;
  
  const reference = mapping.referenceColumn !== undefined ?
    row[mapping.referenceColumn]?.toString().trim() : undefined;

  // Parse IBAN if available
  const iban = mapping.ibanColumn !== undefined ?
    row[mapping.ibanColumn]?.toString().trim() : undefined;

  // Calculate confidence
  let confidence = 0.8;
  if (date === 'Invalid Date') confidence *= 0.3;
  if (amount === 0) confidence *= 0.7;
  if (warnings.length > 0) confidence *= 0.8;

  return {
    date,
    description,
    amount,
    balance,
    counterparty,
    reference,
    iban,
    originalRow: row,
    confidence,
    warnings
  };
}

/**
 * Parse optional numeric field
 */
function parseOptionalNumber(value: any): number | undefined {
  if (!value) return undefined;
  try {
    const locale = localeDetector.getDefaultSpanishLocale();
    const parsed = localeDetector.parseImporte(value.toString(), locale);
    return parsed.value;
  } catch {
    return undefined;
  }
}

// Enhanced service exports
export const enhancedBankStatementImportService = {
  parseFileForPreview,
  importBankStatementEnhanced
};