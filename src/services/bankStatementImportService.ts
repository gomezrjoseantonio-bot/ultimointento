/**
 * Unified Bank Statement Import Service
 * 
 * Implements the single entry point for bank statement imports as required:
 * 1. Parse file → parsedRows[]
 * 2. Call resolveAccountByIBAN() per row
 * 3. Show SelectAccountModal if IBAN not recognized
 * 4. Persist with ONE call to createMovements(rows) (bulk)
 * 5. Refresh store and table
 */

import { BankParserService } from '../features/inbox/importers/bankParser';
import { initDB, Movement } from './db';
import { FLAGS } from '../config/flags';
import { safeMatch } from '../utils/safe';
import toast from 'react-hot-toast';

// Logging prefix as specified in requirements
const LOG_PREFIX = '[TESO-IMPORT]';

export interface ParsedRow {
  account_id?: number;
  value_date: string;
  description: string;
  amount: number;
  type: 'IN' | 'OUT';
  category?: string;
  state: 'CONFIRMED';
  source: 'extracto';
  doc_id?: string;
  originalIndex: number;
}

export interface ImportResult {
  success: boolean;
  inserted: number;
  duplicates: number;
  errors: number;
  createdIds: number[];
  batchId: string;
  // For account selection workflow
  requiresAccountSelection?: boolean;
  unrecognizedIBAN?: string;
  availableAccounts?: Array<{cuenta_id: number; account_name: string; iban?: string; confidence: number}>;
}

export interface ImportOptions {
  file: File;
  destinationAccountId: number; // Now required as per requirements  
  usuario?: string;
}

/**
 * Main entry point for bank statement import
 * Requirements: Always requires destinationAccountId, no auto-detection
 */
export async function importBankStatement(options: ImportOptions): Promise<ImportResult> {
  const { file, destinationAccountId, usuario = 'sistema' } = options;
  
  console.info(`${LOG_PREFIX} Start import, file: ${file.name}, destinationAccount: ${destinationAccountId}`);
  
  // REQUIREMENT: Reject import if no destinationAccountId provided
  if (!destinationAccountId) {
    console.error(`${LOG_PREFIX} bankImport:error - No destination account provided`);
    return {
      success: false,
      inserted: 0,
      duplicates: 0,
      errors: 1,
      createdIds: [],
      batchId: '',
      requiresAccountSelection: true
    };
  }
  
  try {
    console.debug(`${LOG_PREFIX} bankImport:start - Processing file: ${file.name}, size: ${file.size} bytes`);
    
    // Step 1: Parse file → parsedRows[]
    const parsedRows = await parseFileToRows(file);
    console.info(`${LOG_PREFIX} bankImport:parsed - ${parsedRows.length} rows extracted from file`);
    
    // Step 2: Apply destinationAccountId to all rows (no auto-detection)
    const rowsWithAccount = parsedRows.map(row => ({
      ...row,
      account_id: destinationAccountId
    }));
    
    console.debug(`${LOG_PREFIX} All ${rowsWithAccount.length} movements assigned to account ${destinationAccountId}`);
    
    // Step 3: Create movements with ONE bulk call  
    const result = await createMovements(rowsWithAccount, usuario);
    
    console.info(`${LOG_PREFIX} bankImport:persisted - Import completed: ${result.inserted} inserted, ${result.duplicates} duplicates, ${result.errors} errors`);
    
    // Step 4: Show UI toast with real counts
    if (result.success && result.inserted > 0) {
      console.debug(`${LOG_PREFIX} Showing success toast for ${result.inserted} movements`);
      toast.success(`Importados ${result.inserted} movimientos en la cuenta seleccionada`);
    }
    const message = `Importados: ${result.inserted} · Duplicados: ${result.duplicates} · Errores: ${result.errors}`;
    toast.success(message);
    
    return result;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Import error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    toast.error(`Error en importación: ${errorMessage}`);
    
    return {
      success: false,
      inserted: 0,
      duplicates: 0,
      errors: 1,
      createdIds: [],
      batchId: ''
    };
  }
}

/**
 * Parse file to standardized rows format
 */
async function parseFileToRows(file: File): Promise<ParsedRow[]> {
  const bankParser = new BankParserService();
  const parseResult = await bankParser.parseFile(file);
  
  if (!parseResult.success || !parseResult.movements) {
    throw new Error('No se pudieron procesar movimientos del archivo');
  }
  
  return parseResult.movements.map((movement, index) => {
    // Convert to standardized row format
    const amount = typeof movement.amount === 'number' ? movement.amount : parseFloat(String(movement.amount));
    
    // Ensure UTC date format (YYYY-MM-DD)
    let valueDate: string;
    if (movement.date instanceof Date) {
      valueDate = movement.date.toISOString().split('T')[0];
    } else if (typeof movement.date === 'string') {
      // Parse and convert to UTC
      const parsed = new Date(movement.date);
      if (isNaN(parsed.getTime())) {
        // If invalid date, try parsing common formats
        valueDate = parseAndNormalizeDateString(movement.date);
      } else {
        valueDate = parsed.toISOString().split('T')[0];
      }
    } else {
      throw new Error(`Invalid date format in movement: ${movement.date}`);
    }
    
    return {
      value_date: valueDate,
      description: movement.description || '',
      amount: Math.abs(amount), // Always store positive, type indicates direction
      type: amount >= 0 ? 'IN' : 'OUT',
      category: inferCategoryFromDescription(movement.description),
      state: 'CONFIRMED' as const,
      source: 'extracto' as const,
      originalIndex: index
    };
  });
}

/**
 * Create movements with bulk insert and duplicate detection
 */
async function createMovements(rows: ParsedRow[], usuario: string): Promise<ImportResult> {
  const db = await initDB();
  const batchId = `import_${Date.now()}_${usuario}`;
  const now = new Date().toISOString();
  
  // Get existing movements for duplicate detection
  const existingMovements = await db.getAll('movements');
  
  const results = {
    inserted: 0,
    duplicates: 0,
    errors: 0,
    createdIds: [] as number[]
  };
  
  for (const row of rows) {
    try {
      // Duplicate detection by hash {account_id|value_date|amount|description}
      const isDuplicate = existingMovements.some(existing => 
        existing.accountId === row.account_id &&
        existing.date === row.value_date &&
        Math.abs(existing.amount - (row.type === 'OUT' ? -row.amount : row.amount)) < 0.01 &&
        existing.description === row.description
      );
      
      if (isDuplicate) {
        results.duplicates++;
        continue;
      }

      // Validate account exists in database
      const account = await db.get('accounts', row.account_id!);
      if (!account) {
        console.error(`${LOG_PREFIX} Account ${row.account_id} not found, skipping movement`);
        results.errors++;
        continue;
      }

      // Reject demo movements (unless demo mode is explicitly enabled)
      // Enhanced demo detection
      const { isDemoMovement } = await import('./demoDataCleanupService');
      if (!FLAGS.DEMO_MODE && (
          isDemoMovement({ 
            description: row.description, 
            counterparty: '', 
            amount: row.amount, 
            date: row.value_date 
          } as any) ||
          row.description.toLowerCase().includes('demo') || 
          row.description.toLowerCase().includes('test') ||
          row.description.toLowerCase().includes('sample') ||
          row.description.toLowerCase().includes('ejemplo') ||
          row.description.toLowerCase().includes('ficticio')
        )) {
        console.warn(`${LOG_PREFIX} Rejecting demo movement: ${row.description}`);
        results.errors++;
        continue;
      }
      
      // Create movement record
      const movement: Movement = {
        accountId: row.account_id!,
        date: row.value_date,
        valueDate: row.value_date,
        amount: row.type === 'OUT' ? -row.amount : row.amount,
        description: row.description,
        type: row.type === 'IN' ? 'Ingreso' : 'Gasto',
        category: { 
          tipo: row.category || (row.type === 'IN' ? 'Ingresos' : 'Gastos')
        },
        origin: 'CSV', // Use CSV as the closest match since we parse files
        movementState: 'Confirmado',
        state: 'pending',
        status: 'pendiente',
        // ATLAS HORIZON: Required fields
        unifiedStatus: 'no_planificado',
        source: 'import',
        tags: [],
        isAutoTagged: false,
        currency: 'EUR',
        importBatch: batchId,
        csvRowIndex: row.originalIndex,
        createdAt: now,
        updatedAt: now
      };
      
      const createdMovement = await db.add('movements', movement);
      results.inserted++;
      results.createdIds.push(typeof createdMovement === 'number' ? createdMovement : Date.now() + results.inserted);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error creating movement:`, error);
      results.errors++;
    }
  }
  
  return {
    success: true,
    ...results,
    batchId
  };
}

/**
 * Parse and normalize date string to UTC format (YYYY-MM-DD)
 */
function parseAndNormalizeDateString(dateStr: string): string {
  // Common Spanish date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = safeMatch(dateStr, format);
    if (match) {
      const [, p1, p2, p3] = match;
      
      // Determine if it's DD/MM/YYYY or YYYY-MM-DD
      if (p3.length === 4) {
        // DD/MM/YYYY or DD-MM-YYYY
        const day = parseInt(p1, 10);
        const month = parseInt(p2, 10);
        const year = parseInt(p3, 10);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toISOString().split('T')[0];
      } else {
        // YYYY-MM-DD
        const year = parseInt(p1, 10);
        const month = parseInt(p2, 10);
        const day = parseInt(p3, 10);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Fallback: return current date if unparseable
  console.warn(`Could not parse date string: ${dateStr}, using current date`);
  return new Date().toISOString().split('T')[0];
}

/**
 * Infer category from description (basic categorization)
 */
function inferCategoryFromDescription(description: string): string | undefined {
  if (!description) return undefined;
  
  const desc = description.toLowerCase();
  
  // Basic category inference
  if (desc.includes('luz') || desc.includes('endesa') || desc.includes('iberdrola')) {
    return 'Suministros › Luz';
  }
  if (desc.includes('agua') || desc.includes('aqualia')) {
    return 'Suministros › Agua';
  }
  if (desc.includes('gas') || desc.includes('naturgy')) {
    return 'Suministros › Gas';
  }
  if (desc.includes('internet') || desc.includes('fibra') || desc.includes('movistar') || 
      desc.includes('telefon') || desc.includes('telco') || desc.includes('vodafone') ||
      desc.includes('orange') || desc.includes('telecomunicac')) {
    return 'Suministros › Telco';
  }
  if (desc.includes('alquiler') || desc.includes('rent')) {
    return 'Alquiler › Ingresos';
  }
  if (desc.includes('transferencia')) {
    return 'Transferencias';
  }
  
  return undefined;
}