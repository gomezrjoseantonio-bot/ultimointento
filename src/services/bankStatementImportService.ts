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
import { extractIBANFromBankStatement, matchAccountByIBAN } from './ibanAccountMatchingService';
import { initDB, Movement } from './db';
import { isDemoModeEnabled } from '../config/envFlags';
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
}

export interface ImportOptions {
  file: File;
  accountId?: number; // If already known
  skipDuplicates?: boolean;
  usuario?: string;
}

/**
 * Main entry point for bank statement import
 */
export async function importBankStatement(options: ImportOptions): Promise<ImportResult> {
  const { file, accountId, usuario = 'sistema' } = options;
  
  console.info(`${LOG_PREFIX} Start import, file: ${file.name}, size: ${file.size} bytes`);
  
  try {
    // Step 1: Parse file → parsedRows[]
    const parsedRows = await parseFileToRows(file);
    console.info(`${LOG_PREFIX} Rows count: ${parsedRows.length}`);
    
    // Step 2: Resolve account by IBAN if not provided
    let finalAccountId = accountId;
    if (!finalAccountId) {
      const resolvedAccount = await resolveAccountByIBAN(file);
      if (resolvedAccount.requiresSelection) {
        // Return early - UI will handle showing SelectAccountModal
        return {
          success: false,
          inserted: 0,
          duplicates: 0,
          errors: 0,
          createdIds: [],
          batchId: '',
          // Special flag to indicate manual selection needed
          requiresAccountSelection: true,
          unrecognizedIBAN: resolvedAccount.detectedIBAN,
          availableAccounts: resolvedAccount.matches || []
        } as any; // Extend interface as needed
      }
      finalAccountId = resolvedAccount.cuenta_id!;
    }
    
    // Step 3: Apply account_id to all rows
    const rowsWithAccount = parsedRows.map(row => ({
      ...row,
      account_id: finalAccountId
    }));
    
    console.info(`${LOG_PREFIX} Rows after account resolution: ${rowsWithAccount.length}`);
    
    // Step 4: Create movements with ONE bulk call
    const result = await createMovements(rowsWithAccount, usuario);
    
    console.info(`${LOG_PREFIX} API payload length: ${rowsWithAccount.length}`);
    console.info(`${LOG_PREFIX} API response ids length: ${result.createdIds.length}`);
    
    // Step 5: Show UI toast final
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
    
    return {
      value_date: movement.date instanceof Date ? 
        movement.date.toISOString().split('T')[0] : 
        movement.date,
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
 * Resolve account by IBAN for the file
 */
async function resolveAccountByIBAN(file: File): Promise<{
  cuenta_id?: number;
  requiresSelection: boolean;
  detectedIBAN?: string;
  matches?: Array<{cuenta_id: number; account_name: string; iban?: string; confidence: number}>;
}> {
  try {
    // Extract IBAN from the file
    const ibanData = await extractIBANFromBankStatement(file, file.name);
    
    // Match against registered accounts
    const matchResult = await matchAccountByIBAN(ibanData);
    
    return {
      cuenta_id: matchResult.cuenta_id,
      requiresSelection: matchResult.requiresSelection,
      detectedIBAN: ibanData.iban_completo || ibanData.last4,
      matches: matchResult.matches
    };
  } catch (error) {
    console.warn(`${LOG_PREFIX} IBAN resolution failed:`, error);
    // If IBAN detection fails, require manual selection
    return {
      requiresSelection: true,
      detectedIBAN: undefined
    };
  }
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
      if (!isDemoModeEnabled() && (
          row.description.toLowerCase().includes('demo') || 
          row.description.toLowerCase().includes('test') ||
          row.description.toLowerCase().includes('sample'))) {
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
  if (desc.includes('internet') || desc.includes('fibra') || desc.includes('movistar')) {
    return 'Suministros › Internet';
  }
  if (desc.includes('alquiler') || desc.includes('rent')) {
    return 'Alquiler › Ingresos';
  }
  if (desc.includes('transferencia')) {
    return 'Transferencias';
  }
  
  return undefined;
}