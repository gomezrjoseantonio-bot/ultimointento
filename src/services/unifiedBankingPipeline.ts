/**
 * ATLAS HORIZON - Unified Banking Movements Pipeline
 * 
 * Implements the complete unified pipeline per problem statement:
 * 1. Single entry point for Treasury › Import and Inbox › Auto-save
 * 2. Enhanced bank parsing with templates
 * 3. Sophisticated deduplication with hash-based detection  
 * 4. Budget reconciliation with configurable matching
 * 5. Transfer detection between user accounts
 * 6. Comprehensive logging and error handling
 */

import { initDB, Movement, ImportLog, UnifiedMovementStatus, MovementSource } from './db';
import { BankParserService } from '../features/inbox/importers/bankParser';
import { extractIBANFromBankStatement, matchAccountByIBAN } from './ibanAccountMatchingService';
import { deduplicateMovements, MovementToCheck } from './enhancedDeduplicationService';
import { matchMovementsToBudget, MatchResult } from './budgetMatchingService';
import { detectTransfers, applyTransferDetection, checkPendingTransferCompletions } from './transferDetectionService';
import toast from 'react-hot-toast';

const LOG_PREFIX = '[ATLAS-PIPELINE]';

// Generate unique batch ID
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface ParsedBankMovement {
  // Required fields from bank statement
  date: Date;
  amount: number;
  description: string;
  
  // Optional fields  
  bank_ref?: string;
  counterparty?: string;
  iban_detected?: string;
  
  // Processed fields
  accountId?: number;
  normalizedDescription: string;
  
  // Metadata
  originalRow: number;
  rawData?: any;
}

export interface UnifiedImportOptions {
  file: File;
  accountId?: number;        // If already known/selected
  source: MovementSource;    // 'import' | 'manual' | 'inbox' 
  userId?: string;
  skipDuplicates?: boolean;
  skipBudgetMatching?: boolean;
  skipTransferDetection?: boolean;
}

export interface UnifiedImportResult {
  success: boolean;
  
  // Summary counts per problem statement section 11
  created: number;           // New movements created
  conciliated: number;       // Matched with budget
  unplanned: number;         // No budget match found
  skipped: number;           // Duplicates ignored  
  transfers: number;         // Transfer groups detected
  errors: number;            // Processing errors
  
  // Additional data
  createdIds: number[];
  batchId: string;
  importLogId?: number;
  
  // For UI feedback
  detectedAccount?: string;
  requiresAccountSelection?: boolean;
  availableAccounts?: any[];
  errorDetails?: Array<{
    line: number;
    error: string;
    data?: any;
  }>;
}

/**
 * Parse bank statement file into normalized movements
 */
async function parseFileToMovements(file: File): Promise<ParsedBankMovement[]> {
  console.info(`${LOG_PREFIX} Starting file parsing: ${file.name} (${file.size} bytes)`);
  
  try {
    // Use existing bank parser service
    const bankParser = new BankParserService();
    const parseResult = await bankParser.parseFile(file);
    
    if (!parseResult.success || !parseResult.movements) {
      throw new Error(parseResult.error || 'Failed to parse bank statement');
    }
    
    // Convert to our format
    const movements: ParsedBankMovement[] = parseResult.movements.map((movement, index) => ({
      date: movement.date,
      amount: movement.amount,
      description: movement.description || '',
      bank_ref: movement.reference,
      counterparty: movement.counterparty,
      iban_detected: parseResult.metadata?.detectedIBAN,
      normalizedDescription: normalizeDescription(movement.description || ''),
      originalRow: index + 1,
      rawData: movement.rawData
    }));
    
    console.info(`${LOG_PREFIX} Parsed ${movements.length} movements from file`);
    return movements;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error parsing file:`, error);
    throw error;
  }
}

/**
 * Normalize description for consistent processing
 */
function normalizeDescription(description: string): string {
  if (!description) return '';
  return description.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Resolve account by IBAN detection
 */
async function resolveAccountForMovements(
  movements: ParsedBankMovement[], 
  providedAccountId?: number
): Promise<{ accountId: number; requiresSelection: boolean; availableAccounts?: any[] }> {
  
  if (providedAccountId) {
    console.info(`${LOG_PREFIX} Using provided account ID: ${providedAccountId}`);
    return { accountId: providedAccountId, requiresSelection: false };
  }
  
  // Try to detect IBAN from movements
  const detectedIBAN = movements.find(m => m.iban_detected)?.iban_detected;
  
  if (detectedIBAN) {
    console.info(`${LOG_PREFIX} Detected IBAN: ${detectedIBAN}`);
    
    const ibanExtractionResult = {
      iban_completo: detectedIBAN,
      source: 'column' as const,
      confidence: 90
    };
    
    const matchResult = await matchAccountByIBAN(ibanExtractionResult);
    if (matchResult.matches.length === 1) {
      const accountId = matchResult.matches[0].cuenta_id;
      console.info(`${LOG_PREFIX} Matched to account: ${accountId}`);
      return { accountId, requiresSelection: false };
    } else if (matchResult.matches.length > 1) {
      console.warn(`${LOG_PREFIX} Multiple account matches found for IBAN`);
      return { 
        accountId: 0, 
        requiresSelection: true, 
        availableAccounts: matchResult.matches 
      };
    }
  }
  
  console.warn(`${LOG_PREFIX} No IBAN detected or matched - requires manual selection`);
  
  // Get all available accounts for selection
  const db = await initDB();
  const accounts = await db.getAll('accounts');
  const activeAccounts = accounts.filter(acc => !acc.deleted_at);
  
  return { 
    accountId: 0, 
    requiresSelection: true, 
    availableAccounts: activeAccounts 
  };
}

/**
 * Convert parsed movements to database movements
 */
function convertToDbMovements(
  parsedMovements: ParsedBankMovement[], 
  accountId: number,
  source: MovementSource,
  batchId: string
): Movement[] {
  
  return parsedMovements.map(parsed => {
    const now = new Date().toISOString();
    
    // Determine category based on amount sign
    const category = {
      tipo: parsed.amount >= 0 ? 'Ingresos' : 'Gastos',
      subtipo: undefined
    };
    
    return {
      accountId,
      date: parsed.date.toISOString().split('T')[0], // YYYY-MM-DD format
      amount: parsed.amount,
      description: parsed.description,
      counterparty: parsed.counterparty,
      bank_ref: parsed.bank_ref,
      iban_detected: parsed.iban_detected,
      
      // Status management per problem statement
      unifiedStatus: 'no_planificado' as UnifiedMovementStatus, // Will be updated by matching
      source,
      category,
      
      // Import tracking
      importBatch: batchId,
      csvRowIndex: parsed.originalRow,
      
      // Legacy compatibility
      status: 'pendiente' as any,
      type: parsed.amount >= 0 ? 'Ingreso' : 'Gasto',
      origin: source === 'import' ? 'CSV' : 'OCR',
      movementState: 'Confirmado',
      
      createdAt: now,
      updatedAt: now
    } as Movement;
  });
}

/**
 * Create import log entry per problem statement section 11
 */
async function createImportLog(
  file: File,
  result: UnifiedImportResult,
  accountId?: number,
  detectedIBAN?: string
): Promise<number> {
  
  const db = await initDB();
  
  const importLog: ImportLog = {
    fileName: file.name,
    fileSize: file.size,
    importedAt: new Date().toISOString(),
    account_id: accountId,
    detected_iban: detectedIBAN,
    
    totalRows: result.created + result.skipped + result.errors,
    created: result.created,
    conciliated: result.conciliated,
    unplanned: result.unplanned,
    skipped: result.skipped,
    transfers: result.transfers,
    errors: result.errors,
    
    errorDetails: result.errorDetails,
    source: result.batchId.includes('inbox') ? 'inbox_auto' : 'treasury_import',
    batchId: result.batchId,
    userId: 'current_user' // TODO: Get from auth context
  };
  
  const logId = await db.add('importLogs', importLog);
  console.info(`${LOG_PREFIX} Created import log with ID: ${logId}`);
  
  return logId as number;
}

/**
 * Main unified import pipeline
 */
export async function processUnifiedBankImport(options: UnifiedImportOptions): Promise<UnifiedImportResult> {
  const { file, accountId: providedAccountId, source, userId } = options;
  const batchId = generateBatchId();
  
  console.info(`${LOG_PREFIX} Starting unified bank import`, {
    fileName: file.name,
    fileSize: file.size,
    source,
    providedAccountId,
    batchId
  });
  
  try {
    // Step 1: Parse file to movements
    const parsedMovements = await parseFileToMovements(file);
    if (parsedMovements.length === 0) {
      throw new Error('No movements found in file');
    }
    
    // Step 2: Resolve account
    const accountResolution = await resolveAccountForMovements(parsedMovements, providedAccountId);
    
    if (accountResolution.requiresSelection) {
      console.info(`${LOG_PREFIX} Account selection required`);
      return {
        success: false,
        created: 0,
        conciliated: 0,
        unplanned: 0,
        skipped: 0,
        transfers: 0,
        errors: 0,
        createdIds: [],
        batchId,
        requiresAccountSelection: true,
        availableAccounts: accountResolution.availableAccounts
      };
    }
    
    const finalAccountId = accountResolution.accountId;
    
    // Step 3: Convert to database movements
    const dbMovements = convertToDbMovements(parsedMovements, finalAccountId, source, batchId);
    
    // Step 4: Deduplication
    console.info(`${LOG_PREFIX} Starting deduplication for ${dbMovements.length} movements`);
    const deduplicationResult = await deduplicateMovements(dbMovements as MovementToCheck[]);
    const uniqueMovements = deduplicationResult.unique as Movement[];
    
    console.info(`${LOG_PREFIX} Deduplication complete`, {
      total: dbMovements.length,
      unique: uniqueMovements.length,
      duplicates: deduplicationResult.duplicates.length
    });
    
    if (uniqueMovements.length === 0) {
      console.info(`${LOG_PREFIX} No unique movements to process - all duplicates`);
      
      const result: UnifiedImportResult = {
        success: true,
        created: 0,
        conciliated: 0,
        unplanned: 0,
        skipped: deduplicationResult.duplicates.length,
        transfers: 0,
        errors: 0,
        createdIds: [],
        batchId
      };
      
      await createImportLog(file, result, finalAccountId);
      return result;
    }
    
    // Step 5: Budget matching (if enabled)
    let matchResults: MatchResult[] = [];
    if (!options.skipBudgetMatching) {
      console.info(`${LOG_PREFIX} Starting budget matching for ${uniqueMovements.length} movements`);
      matchResults = await matchMovementsToBudget(uniqueMovements);
      
      // Apply match results to movements
      for (let i = 0; i < uniqueMovements.length; i++) {
        const movement = uniqueMovements[i];
        const matchResult = matchResults[i];
        
        movement.unifiedStatus = matchResult.status;
        movement.plan_match_id = matchResult.candidate?.presupuestoLinea.id;
      }
    }
    
    // Step 6: Transfer detection (if enabled)
    let transferDetectionResult;
    if (!options.skipTransferDetection) {
      console.info(`${LOG_PREFIX} Starting transfer detection`);
      transferDetectionResult = await detectTransfers(uniqueMovements);
      await applyTransferDetection(transferDetectionResult);
    }
    
    // Step 7: Persist movements to database
    console.info(`${LOG_PREFIX} Persisting ${uniqueMovements.length} movements to database`);
    const db = await initDB();
    const createdIds: number[] = [];
    
    for (const movement of uniqueMovements) {
      const id = await db.add('movements', movement);
      createdIds.push(id as number);
    }
    
    // Step 8: Check for pending transfer completions
    if (!options.skipTransferDetection) {
      await checkPendingTransferCompletions(uniqueMovements);
    }
    
    // Step 9: Calculate result summary
    const conciliated = matchResults.filter(r => r.status === 'conciliado').length;
    const unplanned = matchResults.filter(r => r.status === 'no_planificado').length;
    const transferGroups = transferDetectionResult?.detectedTransfers.length || 0;
    
    const result: UnifiedImportResult = {
      success: true,
      created: uniqueMovements.length,
      conciliated,
      unplanned,
      skipped: deduplicationResult.duplicates.length,
      transfers: transferGroups,
      errors: 0,
      createdIds,
      batchId,
      detectedAccount: `Account ${finalAccountId}`
    };
    
    // Step 10: Create import log
    const importLogId = await createImportLog(file, result, finalAccountId, parsedMovements[0]?.iban_detected);
    result.importLogId = importLogId;
    
    console.info(`${LOG_PREFIX} Import completed successfully`, {
      batchId,
      created: result.created,
      conciliated: result.conciliated,
      unplanned: result.unplanned,
      skipped: result.skipped,
      transfers: result.transfers
    });
    
    return result;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Import failed:`, error);
    
    const errorResult: UnifiedImportResult = {
      success: false,
      created: 0,
      conciliated: 0,
      unplanned: 0,
      skipped: 0,
      transfers: 0,
      errors: 1,
      createdIds: [],
      batchId,
      errorDetails: [{
        line: 0,
        error: error instanceof Error ? error.message : String(error)
      }]
    };
    
    // Try to create error log
    try {
      await createImportLog(file, errorResult);
    } catch (logError) {
      console.error(`${LOG_PREFIX} Failed to create error log:`, logError);
    }
    
    return errorResult;
  }
}

/**
 * Show UI toast with import results per problem statement section 11
 */
export function showImportToast(result: UnifiedImportResult): void {
  if (result.requiresAccountSelection) {
    toast.error('Selecciona cuenta destino para continuar');
    return;
  }
  
  if (!result.success) {
    toast.error(`Error en importación: ${result.errorDetails?.[0]?.error || 'Error desconocido'}`);
    return;
  }
  
  // Format per problem statement: "Importados: X · Duplicados: Y · Errores: Z"
  const message = `Importados: ${result.created} · Duplicados: ${result.skipped} · Errores: ${result.errors}`;
  
  if (result.errors > 0) {
    toast.error(message);
  } else {
    toast.success(message);
  }
  
  // Additional info if relevant
  if (result.transfers > 0) {
    toast.success(`${result.transfers} transferencias detectadas`);
  }
  
  if (result.conciliated > 0) {
    toast.success(`${result.conciliated} movimientos conciliados con presupuesto`);
  }
}

/**
 * Get import logs for reporting
 */
export async function getImportLogs(limit: number = 50): Promise<ImportLog[]> {
  const db = await initDB();
  
  try {
    const logs = await db.getAll('importLogs');
    return logs
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting import logs:`, error);
    return [];
  }
}